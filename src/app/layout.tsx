import type { Metadata } from 'next';
import { ColorSchemeScript, MantineProvider, createTheme, mantineHtmlProps } from '@mantine/core';
import { Shell } from '@/components/shell';
import '@mantine/core/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Design · 智能海报工作台',
  description: 'AI 生图、可复用海报模板与 Excel 折扣填充',
};

const theme = createTheme({
  primaryColor: 'violet',
  defaultRadius: 'md',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  colors: {
    violet: ['#f1eeff','#e1dbff','#c5b9ff','#a89aff','#9482ff','#806df7','#7058e8','#6047d0','#5137b3','#432e93'],
  },
  components: {
    Button: { defaultProps: { radius: 'md' } },
    Paper: { defaultProps: { radius: 'lg' } },
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" {...mantineHtmlProps}>
      <head><ColorSchemeScript defaultColorScheme="dark" /></head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="dark">
          <Shell>{children}</Shell>
        </MantineProvider>
      </body>
    </html>
  );
}
