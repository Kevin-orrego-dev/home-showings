import { useState } from 'react';
import { cx } from './ui';

/** Listing photo with a friendly placeholder when there's no URL or it fails to load. */
export function ListingPhoto({ url, title, className }: { url: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div
        aria-hidden
        className={cx('flex items-center justify-center bg-gradient-to-br from-brand-100 to-slate-200 text-4xl', className)}
      >
        🏡
      </div>
    );
  }
  return <img src={url} alt={title} onError={() => setFailed(true)} className={cx('object-cover', className)} />;
}
