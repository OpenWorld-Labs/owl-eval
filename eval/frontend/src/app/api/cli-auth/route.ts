import { NextRequest, NextResponse } from 'next/server';
import { stackServerApp } from '@/stack';

export async function POST(request: NextRequest) {
  try {
    // Check if Stack Auth is configured
    const isStackAuthConfigured = 
      process.env.NEXT_PUBLIC_STACK_PROJECT_ID && 
      process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY && 
      process.env.STACK_SECRET_SERVER_KEY;

    if (!isStackAuthConfigured) {
      return NextResponse.json({
        devMode: true,
        message: 'Stack Auth not configured - running in dev mode',
      });
    }

    const body = await request.json();
    const { action } = body;

    // Initialize CLI authentication
    if (action === 'init') {
      const response = await fetch(
        `https://api.stack-auth.com/api/v1/auth/cli`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-stack-project-id': process.env.NEXT_PUBLIC_STACK_PROJECT_ID!,
            'x-stack-secret-server-key': process.env.STACK_SECRET_SERVER_KEY!,
            'x-stack-access-type': 'server',
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Stack Auth CLI init failed:', response.status, errorText);
        throw new Error(`Failed to initialize CLI authentication: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    // Poll for authentication status
    if (action === 'poll') {
      const { pollingCode } = body;
      
      const response = await fetch(
        `https://api.stack-auth.com/api/v1/auth/cli/poll`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-stack-project-id': process.env.NEXT_PUBLIC_STACK_PROJECT_ID!,
            'x-stack-secret-server-key': process.env.STACK_SECRET_SERVER_KEY!,
            'x-stack-access-type': 'server',
          },
          body: JSON.stringify({
            polling_code: pollingCode,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to poll authentication status');
      }

      const data = await response.json();
      
      
      // If authentication is complete, get user info
      if ((data.status === 'completed' || data.status === 'success') && data.refresh_token) {
        // Decode the refresh token to get user info
        try {
          const tokenData = JSON.parse(Buffer.from(data.refresh_token, 'base64').toString());
          
          return NextResponse.json({
            ...data,
            status: 'completed', // Normalize status
            user: {
              id: tokenData.userId,
              email: tokenData.email,
              isAdmin: tokenData.isAdmin,
            },
          });
        } catch (e) {
          console.error('Failed to decode refresh token:', e);
          return NextResponse.json({
            ...data,
            status: 'completed',
          });
        }
      }

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('CLI auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}