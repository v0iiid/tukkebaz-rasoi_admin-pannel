import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://integration-sigma-two.vercel.app/api/hero", {
      cache: "no-store",
    });
    
    if (!res.ok) {
      return NextResponse.json(
        { error: `Integration API returned status ${res.status}` },
        { status: res.status }
      );
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to proxy hero images" },
      { status: 500 }
    );
  }
}
