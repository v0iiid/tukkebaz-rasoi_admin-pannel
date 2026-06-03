import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function handleProxy(
  req: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  const { path } = await props.params;
  const pathString = path.join("/");
  
  // Reconstruct full backend URL
  const searchParams = req.nextUrl.searchParams.toString();
  const targetUrl = `${BACKEND_URL}/${pathString}${searchParams ? `?${searchParams}` : ""}`;
  
  // Reconstruct headers
  const headers = new Headers(req.headers);
  headers.delete("host"); // Remove host header to avoid SSL mismatch
  
  // Fetch body
  let body: any = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      body = await req.text();
    } catch {
      body = null;
    }
  }
  
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });
    
    const responseData = await response.text();
    
    // Parse headers to return
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding" && key.toLowerCase() !== "content-encoding") {
        responseHeaders.set(key, value);
      }
    });
    
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseData);
    } catch {
      return new NextResponse(responseData, {
        status: response.status,
        headers: responseHeaders,
      });
    }
    
    return NextResponse.json(jsonResponse, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Proxy Error: ${error.message}` },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
