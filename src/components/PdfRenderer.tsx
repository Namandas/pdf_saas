"use client"

import { ChevronDown, ChevronUp, Loader2, RotateCcw, RotateCw, Search } from 'lucide-react';
import {Document, Page,pdfjs} from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { useToast } from './ui/use-toast';
import {useResizeDetector} from 'react-resize-detector'
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useState } from 'react';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod'
//pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`
import {useForm} from 'react-hook-form';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import SimpleBar from "simplebar-react"
import PdfFullScreen from './PdfFullScreen';
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();


interface PdfRendererProps{
  url:string
}

export default function PdfRenderer({url}:PdfRendererProps){
  const {toast}=useToast();
  const {width,ref}=useResizeDetector();
  const[numPages,setNumPages]=useState<number | null>(null);
  const[currPage,setCurrPage]=useState<number>(1);
  const [scale,setScale]=useState<number>(1);
  const[rotation,setRotation]=useState<number>(0);
  const[renderedScale,setRenderedScale]=useState<number | null>(null);
  const isLoading=renderedScale!==scale

  const CustomPageValidator=z.object({
    page:z.string().refine((num)=>Number(num)>0 && Number(num)<=numPages!)
  })


  type TCustomPageValidator=z.infer<typeof CustomPageValidator>

  
const handlePageSubmit=({page}:TCustomPageValidator)=>{
     setCurrPage(Number(page))
     setValue("page",String(page))
}
  const {
    register,handleSubmit,formState:{errors},setValue
  }=useForm<TCustomPageValidator>({
    defaultValues:{
      page:"1"
    },
    resolver:zodResolver(CustomPageValidator)
  });

    return (
        <div className="w-full bg-white rounded-md shadow flex flex-col items-center">
          <div className="h-14 w-full border-b border-zinc-200 flex items-center justify-between px-2">
           <div className="flex items-center gap-1.5">
            <Button disabled={currPage<=1} onClick={()=>{
              setCurrPage((prev)=>(prev-1>1 ? prev-1:1))
              setValue("page",String(currPage-1))
            }}
            variant='ghost' aria-label='previous page'>
              <ChevronDown className='h-4 w-4'/>
            </Button>

            <div className='flex items-center gap-1.5'>
                 <Input {...register("page")} onKeyDown={(e)=>{
                  if(e.key==="Enter"){
                    handleSubmit(handlePageSubmit)()
                  }
                 }} className={cn('w-12 h-8',errors.page && "focus-visible:ring-red-500")}/>
                 <p className='text-zinc-700 text-sm space-x-1'>
                  <span>/</span>
                  <span>{numPages ?? 'x'}</span>
                 </p>
            </div>

           <Button onClick={()=>{
            setValue("page",String(currPage+1))
              setCurrPage((prev)=>(prev+1>numPages! ? numPages!:prev+1))
            }} disabled={numPages===undefined  ||  currPage===numPages} variant='ghost' aria-label='next page'>
               <ChevronUp className='h-4 w-4'/>
           </Button>

           </div>

            <div className='space-x-2'>
                   <DropdownMenu >
                    <DropdownMenuTrigger asChild>
                      <Button className='gap-1.5' aria-label='zoom' variant='ghost'>
                        <Search className='h-4 w-4'/>
                        {scale*100}%<ChevronDown className='h-3 w-3 opacity-50'/>
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={()=>setScale(1)}>
                        100%
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={()=>setScale(1.5)}>
                        150%
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={()=>setScale(2)}>
                        200%
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={()=>setScale(2.5)}>
                        250%
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                   </DropdownMenu>

                   <Button onClick={()=>{
                    setRotation((prev)=>
                      prev+90)
                   }} aria-label='rorate 90 degrees'>
                    <RotateCw className='h-4 w-4'></RotateCw>
                   </Button>

                   <PdfFullScreen fileUrl={url}/>
            </div>

          </div>

          <div className="flex-1 w-full max-h-screen">
            <SimpleBar autoHide={false} className='max-h-[calc(100vh-10rem)]'>
               <div ref={ref}>
                <Document loading={
                  <div className='flex
                  justify-center'>
                    <Loader2 className='my-24 h-6 w-6 animate-spin'/>
                  </div>
                }
                onLoadSuccess={({numPages})=>{
                      setNumPages(numPages);
                }}
                onLoadError={()=>{
                  toast({
                    title:'Error loading PDF',
                    description:"Please try again Later",
                    variant:"destructive"
                  })
                }}
                file={url} className='max-h-full'>
                 {isLoading &&  renderedScale ? <Page width={width ? width : 1}
                  scale={scale}
                  key={"@"+renderedScale}
                  pageNumber={currPage}
                  rotate={rotation}
                  />:null}

                  <Page 
                  className={cn(isLoading ? "hidden" : "")}
                  width={width ? width : 1}
                  scale={scale}
                  key={"@"+scale}
                  pageNumber={currPage}
                  rotate={rotation}
                  loading={
                    <div className='flex justify-center'>
                      <Loader2 className='my-24 h-6 w-6 animate-spin'/>
                    </div>
                  }
                  onRenderSuccess={()=>{
                    setRenderedScale(scale)
                  }}
                  />
                </Document>
                
               </div>
               </SimpleBar>
          </div>
        </div>
    )
}