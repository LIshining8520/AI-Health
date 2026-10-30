import { HealthKit, isNativeIPhone } from './apple-health.ts';
export interface ChatAttachment { name: string; data: string }
export const ATTACHMENT_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.docx,.txt,.md,.csv,.json';
export const attachmentBytes = (file: ChatAttachment) => Math.floor(file.data.length * 3 / 4) - (file.data.endsWith('==') ? 2 : file.data.endsWith('=') ? 1 : 0);
export function validateAttachments(files: ChatAttachment[]) {
  if (files.length > 8 || files.reduce((sum, file) => sum + attachmentBytes(file), 0) > 2_500_000) throw new Error('每个会话最多 8 个附件，合计不超过 2.5 MB，请减少文件或开始新对话');
  for (const file of files) {
    const path = file.name.replaceAll('\\', '/');
    const ext = '.' + path.split('.').at(-1)?.toLowerCase();
    if (!ATTACHMENT_ACCEPT.split(',').includes(ext) || path.split('/').includes('..') || path.startsWith('/') || file.name.length > 255 || !file.data) throw new Error(`不支持的文件或文件名：${file.name}`);
  }
}
async function readAttachment(file: File): Promise<ChatAttachment> {
  const name = file.webkitRelativePath || file.name;
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name)) {
    if (file.size > 25_000_000) throw new Error(`图片超过 25 MB：${file.name}`);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`无法读取 ${file.name}，请转换为 JPG/PNG 后重试`));
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效');
      let scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      for (let attempt = 0; attempt < 4; attempt++) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('当前设备无法处理图片');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.8, 0.6, 0.4]) {
          const encoded = canvas.toDataURL('image/jpeg', quality);
          if (!encoded.startsWith('data:image/jpeg;base64,')) throw new Error('图片转换失败，请使用 JPG 图片');
          const result = {name: name.replace(/\.[^/.]+$/, '') + '.jpg', data: encoded.split(',')[1]};
          if (attachmentBytes(result) <= 280_000) return result;
        }
        scale *= 0.7;
      }
      throw new Error(`图片压缩失败：${file.name}`);
    } finally { URL.revokeObjectURL(url); }
  }
  if (file.size > 2_500_000) throw new Error(`文件超过 2.5 MB：${file.name}`);
  return new Promise<ChatAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.onload = () => resolve({name, data:String(reader.result).split(',')[1] || ''});
    reader.readAsDataURL(file);
  });
}
export async function readChatFiles(files: File[]): Promise<ChatAttachment[]> {
  if (files.some(file => file.webkitRelativePath)) {
    files = files.filter(file => !file.webkitRelativePath.split('/').some(part => part.startsWith('.')) && ATTACHMENT_ACCEPT.split(',').includes('.' + file.name.split('.').at(-1)?.toLowerCase()));
    if (!files.length) throw new Error('文件夹中没有支持的图片、PDF、Word 或文本文件');
  }
  if (files.length > 8) throw new Error('最多选择 8 个文件');
  // Process one at a time to avoid decoding multiple full-resolution photos in memory.
  const result: ChatAttachment[] = [];
  for (const file of files) result.push(await readAttachment(file));
  validateAttachments(result);
  return result;
}
export const isImageAttachment = (file: ChatAttachment) => /\.(png|jpe?g|webp|gif)$/i.test(file.name);
export const attachmentImageUrl = (file: ChatAttachment) => `data:image/${/\.png$/i.test(file.name) ? 'png' : /\.webp$/i.test(file.name) ? 'webp' : /\.gif$/i.test(file.name) ? 'gif' : 'jpeg'};base64,${file.data}`;
export async function pickNativeFolder() {
  if (!isNativeIPhone()) return [];
  const result = await HealthKit.pickFolder();
  validateAttachments(result.files);
  return result.files;
}

export async function pickNativeImages(camera = false) {
  const result = camera ? await HealthKit.takePhoto() : await HealthKit.pickImages();
  validateAttachments(result.files);
  return result.files;
}

export async function pickNativeFiles() {
  const result = await HealthKit.pickFiles();
  validateAttachments(result.files);
  return result.files;
}
