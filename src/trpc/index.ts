import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import {privateProcedure, publicProcedure, router} from './trpc'
import { get } from 'http';
import { TRPCError } from '@trpc/server';
import { db } from '@/db';
import { trpc } from '@/app/_trpc/client';
import {z} from 'zod';
import { INFINITE_QUERY_LIMIT } from '@/config/infinite-query';
import { absoluteUrl } from '@/lib/utils';
import { getUserSubscriptionPlan ,stripe} from '@/lib/stripe';
import { PLANS } from '@/config/stripe';

// query->get request
// mutation->dispatch,put,post,delete request

export const appRouter=router({
  authCallback : publicProcedure.query(async()=>{
      const {getUser}=getKindeServerSession();
      const user=await getUser();

      if(!user || !user.email)
        throw new TRPCError({code:'UNAUTHORIZED'});
    // check if user is in the db
   const dbuser=await db.user.findFirst({
    where:{
        id:user.id
    }
   })
   // is user is not  in db
       if(!dbuser){
             await db.user.create({
                data:{
                    id:user.id,
                    email:user.email
                }
             })
       }
    // if user is in db
    return {success:true}
  }),
  getUserFiles:privateProcedure.query(async({ctx})=>{
       const {userId,user}=ctx;
       const id=user.id;
       return await db.file.findMany({
        where:{
          userId
        }
       }) 
  }), 
  deleteFile:privateProcedure.input(z.object({ id:z.string()})
).mutation(async({ctx,input})=>{
   const {userId}=ctx;
   
   const file=await db.file.findFirst({
    where:{
       id:input.id,
       userId:userId
    }
   })
   if(!file){
    throw new TRPCError({code:'NOT_FOUND'})
   }
   const deletedFile=await db.file.delete({
    where:{
      id:input.id
    }
   })
   return deletedFile;
}),
getFile:privateProcedure.input(z.object({key:z.string()})).mutation(async({ctx,input})=>{
    const {userId}=ctx;
  
    const file=await db.file.findFirst({
      where:{
        key:input.key,
        userId
      }
    })
    if(!file)throw new TRPCError({code:'NOT_FOUND'})
      return file;
}),
getFileUploadStatus: privateProcedure
.input(z.object({ fileId: z.string() }))
.query(async ({ input, ctx }) => {
  const file = await db.file.findFirst({
    where: {
      id: input.fileId,
      userId: ctx.userId,
    },
  })
  if (!file) return { status: 'PENDING' as const }

  console.log("the file upload status is "+file.uploadStatus)
  return { status: file.uploadStatus }
}),
getFileMessages:privateProcedure.input(
 z.object({
  limit:z.number().min(1).max(100).nullish(),
  cursor:z.string().nullish(),
  fileId:z.string()
 })
).query(async({ctx,input})=>{
     const {userId}=ctx;
     const {fileId,cursor}=input;
     const limit=input.limit ?? INFINITE_QUERY_LIMIT
     const file=await db.file.findFirst({
      where:{
        id:fileId,
        userId
      }
     })
   if(!file)
    throw new TRPCError({code:"NOT_FOUND"})
  const messages=await db.message.findMany({
    take:limit+1,
    where:{
      fileId
    },
    orderBy:{
      createdAt:"desc"
    },
    cursor:cursor ? {id:cursor}:undefined,
    select:{
      id:true,
      isUserMessage:true,
      createdAt:true,
      text:true
    }
  })
  // logic for the next cursor
  let nextCursor:typeof cursor | undefined=undefined
  if(messages.length>limit){
    const nextItem=messages.pop()
    nextCursor=nextItem?.id
  }
  return {
    messages,
    nextCursor
  }
}),

createStripeSession: privateProcedure.mutation(
  async ({ ctx }) => {
    const { userId } = ctx

    const billingUrl = absoluteUrl('/dashboard/billing')

    if (!userId)
      throw new TRPCError({ code: 'UNAUTHORIZED' })

    const dbUser = await db.user.findFirst({
      where: {
        id: userId,
      },
    })

    if (!dbUser)
      throw new TRPCError({ code: 'UNAUTHORIZED' })

    const subscriptionPlan =
      await getUserSubscriptionPlan()

    if (
      subscriptionPlan.isSubscribed &&
      dbUser.stripeCustomerId
    ) {
      const stripeSession =
        await stripe.billingPortal.sessions.create({
          customer: dbUser.stripeCustomerId,
          return_url: billingUrl,
        })

      return { url: stripeSession.url }
    }

    const stripeSession =
      await stripe.checkout.sessions.create({
        success_url: billingUrl,
        cancel_url: billingUrl,
        payment_method_types: ['card', 'paypal'],
        mode: 'subscription',
        billing_address_collection: 'auto',
        line_items: [
          {
            price: PLANS.find(
              (plan) => plan.name === 'Pro'
            )?.price.priceIds.test,
            quantity: 1,
          },
        ],
        metadata: {
          userId: userId,
        },
      })

    return { url: stripeSession.url }
  }
),

   

});


export type AppRouter=typeof appRouter;