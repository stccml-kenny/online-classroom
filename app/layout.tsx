import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Online-Classroom',
  description: 'Online-Classroom 導師端教學與班級管理系統',
  applicationName: 'Online-Classroom',
  appleWebApp: {
    capable: true,
    title: 'Online-Classroom',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK">
      <head>
        <title>Online-Classroom</title>
        <meta name="application-name" content="Online-Classroom" />
        <meta name="apple-mobile-web-app-title" content="Online-Classroom" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined') {
                  var origErr = console.error;
                  console.error = function() {
                    if (arguments.length > 0 && typeof arguments[0] === 'string' &&
                        (arguments[0].indexOf('Realtime got disconnected') !== -1 ||
                         arguments[0].indexOf('Reconnect will be attempted') !== -1)) {
                      console.debug.apply(console, arguments);
                      return;
                    }
                    origErr.apply(console, arguments);
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
