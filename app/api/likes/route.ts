import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function handle(request:Request, method:"POST"|"DELETE") {
  const body=method==="POST" || method==="DELETE" ? await request.json().catch(()=>({})) : {};
  const uploadId=typeof body.uploadId==="string" ? body.uploadId : "";
  if(!/^[0-9a-f-]{36}$/i.test(uploadId)) return NextResponse.json({error:"Invalid uploadId"},{status:400});
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Login required"},{status:401});
  if(method==="POST") {
    const {error}=await supabase.from("likes").insert({upload_id:uploadId,user_id:user.id});
    if(error && error.code!=="23505") return NextResponse.json({error:error.message},{status:400});
  } else {
    const {error}=await supabase.from("likes").delete().eq("upload_id",uploadId).eq("user_id",user.id);
    if(error) return NextResponse.json({error:error.message},{status:400});
  }
  const {count}=await supabase.from("likes").select("*",{count:"exact",head:true}).eq("upload_id",uploadId);
  return NextResponse.json({liked:method==="POST",count:count||0});
}
export async function POST(request:Request){return handle(request,"POST");}
export async function DELETE(request:Request){return handle(request,"DELETE");}
