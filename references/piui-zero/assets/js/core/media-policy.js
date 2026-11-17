export const MEDIA_LIMITS={batch:20,sessionBytes:50*1024*1024,pixels:20000000,sessionFiles:30};
export function mediaBudget({bytes=0,files=0,width=0,height=0}={}) {
 if(files>MEDIA_LIMITS.sessionFiles)return 'Batas sesi 30 berkas; muat ulang untuk memulai sesi baru.';
 if(bytes>MEDIA_LIMITS.sessionBytes)return 'Total preview sesi melebihi 50 MB.';
 if(width*height>MEDIA_LIMITS.pixels||width<=0||height<=0)return 'Dimensi tidak valid atau melebihi 20 juta piksel.';
 return '';
}
