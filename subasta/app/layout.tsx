import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Héctor Herrera · Subastas de arte',description:'Descubre obras que conectan contigo. Subastas de arte contemporáneo en línea.'};
export default function Layout({children}:Readonly<{children:React.ReactNode}>){return <html lang="es"><body>{children}</body></html>}
