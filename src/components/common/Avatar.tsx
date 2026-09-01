import { useState } from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: string; // tailwind class, contoh: 'w-7 h-7'
  className?: string;
}

/**
 * Avatar driver: tampilkan foto kalau ada, fallback ikon user.
 * Dipakai di tabel driver (P2H, Eco, dll).
 */
export default function Avatar({ name, src, size = 'w-7 h-7', className = '' }: AvatarProps) {
  const [error, setError] = useState(false);
  if (src && !error) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setError(true)}
        className={`${size} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-[#D97757] to-[#C15F3C] flex items-center justify-center text-white shrink-0 ${className}`}>
      <User className="w-4 h-4" />
    </div>
  );
}
