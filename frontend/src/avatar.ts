/**
 * 用户头像：只保存在本机 localStorage，不经过后端、不随健康数据导出。
 * 上传后统一裁剪为方形并压缩成 JPEG，避免大图撑爆本地存储。
 */

const AVATAR_KEY = "zhikang-avatar";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FALLBACK_MAX_BYTES = 900 * 1024;
const AVATAR_SIDE = 256;
const JPEG_QUALITY = 0.86;

export function readStoredAvatar(): string {
  try {
    return localStorage.getItem(AVATAR_KEY) || "";
  } catch {
    return "";
  }
}

export function storeAvatar(dataUrl: string): boolean {
  try {
    localStorage.setItem(AVATAR_KEY, dataUrl);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredAvatar() {
  try {
    localStorage.removeItem(AVATAR_KEY);
  } catch {
    /* 忽略：隐私模式下不可写 */
  }
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败，请重试"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片解析失败"));
    image.src = src;
  });
}

/** 读取用户选择的图片，居中裁成正方形并压缩，返回可直接放进 img 的 data URL。 */
export async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件（JPG、PNG 等）");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("图片超过 10MB，请换一张更小的图片");
  }
  const original = await readAsDataUrl(file);
  if (!original) throw new Error("图片读取失败，请重试");
  const image = await loadImage(original).catch(() => {
    // 浏览器无法解码（如部分 HEIC），直接提示换格式，避免存下无法显示的头像。
    throw new Error("无法识别这张图片，请换一张 JPG 或 PNG 图片");
  });
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("图片尺寸异常，请换一张图片");
  try {
    const side = Math.min(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIDE;
    canvas.height = AVATAR_SIDE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no-2d-context");
    context.drawImage(
      image,
      (width - side) / 2,
      (height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIDE,
      AVATAR_SIDE,
    );
    const compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (!compressed.startsWith("data:image/")) throw new Error("encode-failed");
    return compressed;
  } catch {
    // 能解码但无法压缩（如超大图），小文件直接原样保存。
    if (file.size <= FALLBACK_MAX_BYTES) return original;
    throw new Error("图片处理失败，请换一张更小的 JPG 或 PNG 图片");
  }
}
