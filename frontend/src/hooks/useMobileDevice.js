import { useState, useEffect } from 'react';

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

const detect = () =>
  MOBILE_UA.test(navigator.userAgent) || window.innerWidth < 1024;

export const useMobileDevice = () => {
  const [isMobile, setIsMobile] = useState(detect);

  useEffect(() => {
    const handler = () => setIsMobile(detect());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return isMobile;
};
