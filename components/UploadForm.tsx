"use client";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/types/database";

type Language = "en" | "tr" | "ru" | "de" | "es" | "fr";

const MAX_PHOTOS = 10;
const MAX_VIDEOS = 1;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface FileItem extends File {
  preview?: string;
  cover?: boolean;
}

const TEXTS: Record<Language, Record<string,string>> = {
  en: {
    eyebrow: "Publish", h2: "Show the world what your setup can do.", lead: "Attach the actual camera and lens so other photographers can discover the result.",
    photosVideo: "Photos and/or video", noticePhotos: "Up to {maxPhotos} photos + {maxVideos} video per post. Photos stay permanently; videos expire after 10 days.",
    camera: "Camera", cameraType: "Camera type", camcorder: "Handycam / Camcorder", lens: "Lens", lensNotApplicable: "(not applicable)", placeholderCamera: "Sony A7 III", placeholderLens: "FE 50mm F1.8",
    price: "Price", currency: "Currency", title: "Title", description: "Description", descPlaceholder: "Tell people how the setup performed...",
    categories: "Categories", videosExpire: "Videos automatically expire after 10 days. Photos remain in the post.",
    publish: "Publish to CamWizards", publishing: "Publishing...",
    errorTitle: "Title is required.", errorCamera: "Camera name is required.", errorCategory: "Choose at least one category.", errorFile: "Choose at least one photo or video.", errorMaxPhotos: "Maximum {max} photos.", errorMaxVideos: "Maximum {max} video.", errorTooLarge: "{name} is too large (max 50MB).", errorInvalidImage: "Invalid image type: {type}.", errorInvalidVideo: "Invalid video type: {type}.", errorUpload: "Some files failed to upload. The post was not created.",
    cover: "Cover", coverActive: "★ Cover", remove: "×", photoLabel: "PHOTO", videoLabel: "VIDEO"
  },
  tr: {
    eyebrow: "Yayınla", h2: "Kurumun dünyayı görsün.", lead: "Gerçek kamera ve lensi ekleyin ki diğer fotoğrafçılar sonucu keşfetsin.",
    photosVideo: "Fotoğraf ve/veya video", noticePhotos: "Gönderide en fazla {maxPhotos} fotoğraf + {maxVideos} video. Fotoğraflar kalıcı kalır; videolar 10 gün sonra süresi dolar.",
    camera: "Kamera", cameraType: "Kamera türü", camcorder: "Kamera çubuğu / Camcorder", lens: "Lens", lensNotApplicable: "(uygulanmaz)", placeholderCamera: "Sony A7 III", placeholderLens: "FE 50mm F1.8",
    price: "Fiyat", currency: "Para birimi", title: "Başlık", description: "Açıklama", descPlaceholder: "Kurumun nasıl performans gösterdiğini söyleyin...",
    categories: "Kategoriler", videosExpire: "Videolar otomatik olarak 10 gün sonra süresi dolar. Fotoğraflar gönderide kalır.",
    publish: "CamWizards'da yayınla", publishing: "Yayınlanıyor...",
    errorTitle: "Başlık zorunludur.", errorCamera: "Kamera adı zorunludur.", errorCategory: "En az bir kategori seçin.", errorFile: "En az bir fotoğraf veya video seçin.", errorMaxPhotos: "Maksimum {max} fotoğraf.", errorMaxVideos: "Maksimum {max} video.", errorTooLarge: "{name} çok büyük (maksimum 50MB).", errorInvalidImage: "Geçersiz görüntü tipi: {type}.", errorInvalidVideo: "Geçersiz video tipi: {type}.", errorUpload: "Bazı dosyalar yüklenemedi. Gönderi oluşturulamadı.",
    cover: "Kapak", coverActive: "★ Kapak", remove: "×", photoLabel: "FOTOĞRAF", videoLabel: "VIDEO"
  },
  ru: {
    eyebrow: "Опубликовать", h2: "Покажите миру вашу технику.", lead: "Прикрепите реальную камеру и объектив, чтобы другие фотографы могли открыть результат.",
    photosVideo: "Фото и/или видео", noticePhotos: "До {maxPhotos} фото + {maxVideos} видео в посте. Фото остаются навсегда; видео истекают через 10 дней.",
    camera: "Камера", cameraType: "Тип камеры", camcorder: "Видеокамера / Камера-просто", lens: "Объектив", lensNotApplicable: "(не применимо)", placeholderCamera: "Sony A7 III", placeholderLens: "FE 50mm F1.8",
    price: "Цена", currency: "Валюта", title: "Заголовок", description: "Описание", descPlaceholder: "Расскажите, как показала себя техника...",
    categories: "Категории", videosExpire: "Видео автоматически истекает через 10 дней. Фото остаются в посте.",
    publish: "Опубликовать на CamWizards", publishing: "Публикация...",
    errorTitle: "Требуется заголовок.", errorCamera: "Требуется название камеры.", errorCategory: "Выберите хотя бы одну категорию.", errorFile: "Выберите хотя бы одну фото или видео.", errorMaxPhotos: "Максимум {max} фото.", errorMaxVideos: "Максимум {max} видео.", errorTooLarge: "{name} слишком велик (макс. 50МБ).", errorInvalidImage: "Неверный тип изображения: {type}.", errorInvalidVideo: "Неверный тип видео: {type}.", errorUpload: "Некоторые файлы не загружены. Пост не создан.",
    cover: "Обложка", coverActive: "★ Обложка", remove: "×", photoLabel: "ФОТО", videoLabel: "ВИДЕО"
  },
  de: {
    eyebrow: "Veröffentlichen", h2: "Zeigen Sie der Welt, was Ihre Ausrüstung kann.", lead: "Hängen Sie die tatsächliche Kamera und das Objektiv an, damit andere Fotografen das Ergebnis entdecken können.",
    photosVideo: "Fotos und/oder Video", noticePhotos: "Bis zu {maxPhotos} Fotos + {maxVideos} Video pro Beitrag. Fotos bleiben dauerhaft; Videos laufen nach 10 Tagen ab.",
    camera: "Kamera", cameraType: "Kameratyp", camcorder: "Handycam / Camcorder", lens: "Objektiv", lensNotApplicable: "(nicht zutreffend)", placeholderCamera: "Sony A7 III", placeholderLens: "FE 50mm F1.8",
    price: "Preis", currency: "Währung", title: "Titel", description: "Beschreibung", descPlaceholder: "Erzählen Sie den Leuten, wie sich die Ausrüstung bewährt hat...",
    categories: "Kategorien", videosExpire: "Videos laufen automatisch nach 10 Tagen ab. Fotos bleiben im Beitrag.",
    publish: "Auf CamWizards veröffentlichen", publishing: "Wird veröffentlicht...",
    errorTitle: "Titel erforderlich.", errorCamera: "Kameraname erforderlich.", errorCategory: "Wählen Sie mindestens eine Kategorie.", errorFile: "Wählen Sie mindestens ein Foto oder Video.", errorMaxPhotos: "Maximal {max} Fotos.", errorMaxVideos: "Maximal {max} Video.", errorTooLarge: "{name} ist zu groß (max. 50 MB).", errorInvalidImage: "Ungültiger Bildtyp: {type}.", errorInvalidVideo: "Ungültiger Videotyp: {type}.", errorUpload: "Einige Dateien konnten nicht hochgeladen werden. Der Beitrag wurde nicht erstellt.",
    cover: "Cover", coverActive: "★ Cover", remove: "×", photoLabel: "FOTO", videoLabel: "VIDEO"
  },
  es: {
    eyebrow: "Publicar", h2: "Muestra al mundo lo que tu equipo puede hacer.", lead: "Adjunta la cámara y el objetivo reales para que otros fotógrafos puedan descubrir el resultado.",
    photosVideo: "Fotos y/o video", noticePhotos: "Hasta {maxPhotos} fotos + {maxVideos} video por publicación. Las fotos permanecen permanentemente; los videos expiran después de 10 días.",
    camera: "Cámara", cameraType: "Tipo de cámara", camcorder: "Cámara de video / Camcorder", lens: "Lente", lensNotApplicable: "(no aplicable)", placeholderCamera: "Sony A7 III", placeholderLens: "FE 50mm F1.8",
    price: "Precio", currency: "Moneda", title: "Título", description: "Descripción", descPlaceholder: "Cuéntales a las personas cómo funcionó el equipo...",
    categories: "Categorías", videosExpire: "Los videos expiran automáticamente después de 10 días. Las fotos permanecen en la publicación.",
    publish: "Publicar en CamWizards", publishing: "Publicando...",
    errorTitle: "Se requiere título.", errorCamera: "Se requiere nombre de cámara.", errorCategory: "Elige al menos una categoría.", errorFile: "Elige al menos una foto o video.", errorMaxPhotos: "Máximo {max} fotos.", errorMaxVideos: "Máximo {max} video.", errorTooLarge: "{name} es demasiado grande (máx. 50 MB).", errorInvalidImage: "Tipo de imagen no válido: {type}.", errorInvalidVideo: "Tipo de video no válido: {type}.", errorUpload: "Algunos archivos no se pudieron subir. La publicación no se creó.",
    cover: "Portada", coverActive: "★ Portada", remove: "×", photoLabel: "FOTO", videoLabel: "VIDEO"
  },
  fr: {
    eyebrow: "Publier", h2: "Montrez au monde ce que votre équipement peut faire.", lead: "Joignez l'appareil photo et l'objectif réels pour que d'autres photographes puissent découvrir le résultat.",
    photosVideo: "Photos et/ou vidéo", noticePhotos: "Jusqu'à {maxPhotos} photos + {maxVideos} vidéo par publication. Les photos restent définitivement ; les vidéos expirent après 10 jours.",
    camera: "Appareil photo", cameraType: "Type d'appareil", camcorder: "Caméscope", lens: "Objectif", lensNotApplicable: "(non applicable)", placeholderCamera: "Sony A7 III", placeholderLens: "FE 50mm F1.8",
    price: "Prix", currency: "Devise", title: "Titre", description: "Description", descPlaceholder: "Dites aux gens comment le matériel s'est comporté...",
    categories: "Catégories", videosExpire: "Les vidéos expirent automatiquement après 10 jours. Les photos restent dans la publication.",
    publish: "Publier sur CamWizards", publishing: "Publication...",
    errorTitle: "Titre requis.", errorCamera: "Nom de l'appareil requis.", errorCategory: "Choisissez au moins une catégorie.", errorFile: "Choisissez au moins une photo ou une vidéo.", errorMaxPhotos: "Maximum {max} photos.", errorMaxVideos: "Maximum {max} vidéo.", errorTooLarge: "{name} est trop volumineux (max. 50 Mo).", errorInvalidImage: "Type d'image non valide: {type}.", errorInvalidVideo: "Type de vidéo non valide: {type}.", errorUpload: "Certains fichiers n'ont pas pu être téléchargés. La publication n'a pas été créée.",
    cover: "Couverture", coverActive: "★ Couverture", remove: "×", photoLabel: "PHOTO", videoLabel: "VIDÉO"
  }
};

export function UploadForm({ locale="en" }: { locale?: Language }) {
  const T = TEXTS[locale] || TEXTS.en;
  const [photos, setPhotos] = useState<FileItem[]>([]);
  const [videos, setVideos] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [camcorder, setCamcorder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");

  useEffect(() => {
    const urls = [...photos, ...videos].map(file => file.type.startsWith("image/") ? (file.preview || URL.createObjectURL(file)) : "");
    return () => urls.forEach(url => { if (url && url.startsWith("blob:")) URL.revokeObjectURL(url); });
  }, [photos, videos]);

  function toggleCategory(category: string) {
    setCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category]);
  }

  function chooseFiles(list: FileList | null) {
    const files = Array.from(list || []);
    const newPhotos: FileItem[] = [];
    const newVideos: FileItem[] = [];
    for (const file of files) {
      const item: FileItem = { ...file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined };
      if (file.type.startsWith("video/")) newVideos.push(item);
      else newPhotos.push(item);
    }
    setPhotos(current => [...current, ...newPhotos].slice(0, MAX_PHOTOS));
    setVideos(current => [...current, ...newVideos].slice(0, MAX_VIDEOS));
    setMessage("");
  }

  function removePhoto(index: number) {
    setPhotos(current => current.filter((_, i) => i !== index));
  }
  function removeVideo(index: number) {
    setVideos(current => current.filter((_, i) => i !== index));
  }
  function setCover(index: number) {
    setPhotos(current => current.map((p, i) => ({ ...p, cover: i === index })));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const camera = String(form.get("camera") || "").trim();
    const lens = camcorder ? null : String(form.get("lens") || "").trim() || null;
    const price = form.get("price") ? Number(form.get("price")) : null;
    const currency = String(form.get("currency") || "USD").trim();
    const coverIndex = Number(form.get("cover_index") || "0");

    if (!title) return setMessage(T.errorTitle);
    if (!camera) return setMessage(T.errorCamera);
    if (!categories.length) return setMessage(T.errorCategory);
    if (photos.length === 0 && videos.length === 0) return setMessage(T.errorFile);
    if (photos.length > MAX_PHOTOS) return setMessage(T.errorMaxPhotos.replace("{max}", String(MAX_PHOTOS)));
    if (videos.length > MAX_VIDEOS) return setMessage(T.errorMaxVideos.replace("{max}", String(MAX_VIDEOS)));

    const allFiles = [...photos.map(f => ({ file: f, type: "photo" as const })), ...videos.map(f => ({ file: f, type: "video" as const }))];
    for (const { file } of allFiles) {
      if (file.size > MAX_FILE_SIZE) return setMessage(T.errorTooLarge.replace("{name}", file.name));
      if (file.type.startsWith("image/") && !["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)) return setMessage(T.errorInvalidImage.replace("{type}", file.type));
      if (file.type.startsWith("video/") && !["video/mp4","video/webm","video/quicktime"].includes(file.type)) return setMessage(T.errorInvalidVideo.replace("{type}", file.type));
    }

    setBusy(true);
    setMessage("");
    setProgress("");
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: form
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setPhotos([]);
      setVideos([]);
      setCategories([]);
      setMessage("Upload successful!");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : T.errorUpload);
    } finally {
      setBusy(false);
    }
  }

  const allCount = photos.length + videos.length;
  const noticePhotosText = T.noticePhotos.replace("{maxPhotos}", String(MAX_PHOTOS)).replace("{maxVideos}", String(MAX_VIDEOS));
  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="full">
        <label className="label">{T.photosVideo}</label>
        <input className="input" type="file" accept="image/*,video/*" multiple disabled={busy} onChange={event => chooseFiles(event.target.files)} />
        <div className="notice" style={{marginTop:8}}>{noticePhotosText}</div>
        {allCount > 0 && (
          <div className="file-preview-grid">
            {photos.map((file, i) => (
              <div className="file-preview" key={`${file.name}-${i}`} style={{position:"relative"}}>
                {file.preview ? <img src={file.preview} alt="" /> : <div className="file-video-preview">{T.photoLabel}</div>}
                <span title={file.name}>{file.name}</span>
                <button className="btn danger" onClick={() => removePhoto(i)} style={{position:"absolute",top:4,right:4,padding:4}}>{T.remove}</button>
                {allCount > 1 && <button className="btn" onClick={() => setCover(i)} style={{position:"absolute",bottom:4,right:4,padding:4,fontSize:10}}>{file.cover ? T.coverActive : T.cover}</button>}
              </div>
            ))}
            {videos.map((file, i) => (
              <div className="file-preview" key={`video-${file.name}-${i}`} style={{position:"relative"}}>
                <div className="file-video-preview">{T.videoLabel}</div>
                <span title={file.name}>{file.name}</span>
                <button className="btn danger" onClick={() => removeVideo(i)} style={{position:"absolute",top:4,right:4,padding:4}}>{T.remove}</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div><label className="label">{T.camera}</label><input className="input" name="camera" placeholder={T.placeholderCamera} required disabled={busy} /></div>
      <div><label className="label">{T.cameraType}</label><label className="check"><input type="checkbox" checked={camcorder} disabled={busy} onChange={event=>setCamcorder(event.target.checked)} /> {T.camcorder}</label></div>
      <div><label className="label">{T.lens} {camcorder ? T.lensNotApplicable : ""}</label><input className="input" name="lens" placeholder={T.placeholderLens} disabled={camcorder || busy} /></div>
      <div><label className="label">{T.price}</label><input className="input" name="price" type="number" min="0" step="0.01" placeholder="999" disabled={busy} /></div>
      <div><label className="label">{T.currency}</label><select name="currency" disabled={busy}><option>TRY</option><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option></select></div>
      <div className="full"><label className="label">{T.title}</label><input className="input" name="title" placeholder="Rainy Tokyo crossing" required disabled={busy} /></div>
      <div className="full"><label className="label">{T.description}</label><textarea name="description" rows={4} placeholder={T.descPlaceholder} disabled={busy} /></div>
      <div className="full"><label className="label">{T.categories}</label><div className="check-grid">{CATEGORIES.map(category=><label className="check" key={category}><input type="checkbox" checked={categories.includes(category)} disabled={busy} onChange={()=>toggleCategory(category)} />{category}</label>)}</div></div>
      <div className="full"><div className="notice">{T.videosExpire}</div></div>
      <div className="full"><button className="btn primary" disabled={busy||allCount===0}>{busy ? T.publishing : T.publish}</button>{progress && <p className="muted" aria-live="polite">{progress}</p>}{message && <p className={message.toLowerCase().includes("success") ? "success" : "error"} aria-live="polite">{message}</p>}</div>
    </form>
  );
}
