import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveBan } from "@/lib/community/access";

export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to report content."},{status:401});
 if(await getActiveBan(user.id))return NextResponse.json({error:"Your account is suspended."},{status:403});
 let body:{uploadId?:string;reason?:string};
 try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
 if(!body.uploadId||!body.reason)return NextResponse.json({error:"Choose a reason."},{status:400});
 const {data:upload}=await supabase.from("uploads").select("id,user_id").eq("id",body.uploadId).maybeSingle();
 if(!upload)return NextResponse.json({error:"Post not found."},{status:404});
 if(upload.user_id===user.id)return NextResponse.json({error:"You cannot report your own post."},{status:400});
 const {error}=await supabase.from("user_reports").insert({reporter_id:user.id,upload_id:body.uploadId,reason:String(body.reason).slice(0,300)});
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({ok:true});
}