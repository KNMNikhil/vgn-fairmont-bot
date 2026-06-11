import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase
    .from("residents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, name, flat_number, is_approved } = body;

    if (!phone) {
      return Response.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Clean phone number (keep only digits)
    const cleanPhone = phone.replace(/\D/g, '');

    const { data, error } = await supabase
      .from("residents")
      .upsert({
        phone: cleanPhone,
        name: name || null,
        flat_number: flat_number || null,
        is_approved: is_approved !== undefined ? is_approved : true,
      })
      .select()
      .single();

    if (error) throw error;
    
    return Response.json({ success: true, data });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    
    if (!phone) {
      return Response.json({ error: "Phone number is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("residents")
      .delete()
      .eq("phone", phone);

    if (error) throw error;
    
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
