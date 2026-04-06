import { ref } from 'vue';

const MAX_DIMENSION = 1920;
const QUALITY = 0.8;

export function useCamera() {
  const selectedFile = ref<File | null>(null);
  const previewUrl = ref<string | null>(null);
  const isCompressing = ref(false);

  function compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      isCompressing.value = true;
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);

        let { width, height } = img;

        // Only resize if larger than max dimension
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          isCompressing.value = false;
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            isCompressing.value = false;
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            const compressed = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '.webp'),
              {
                type: 'image/webp',
                lastModified: Date.now(),
              },
            );
            resolve(compressed);
          },
          'image/webp',
          QUALITY,
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        isCompressing.value = false;
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  async function handleFileSelect(file: File) {
    try {
      const compressed = await compressImage(file);
      selectedFile.value = compressed;
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = URL.createObjectURL(compressed);
    } catch (err) {
      console.error('[useCamera] Compression failed:', err);
      // Fall back to original file
      selectedFile.value = file;
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = URL.createObjectURL(file);
    }
  }

  function clear() {
    selectedFile.value = null;
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
  }

  return {
    selectedFile,
    previewUrl,
    isCompressing,
    handleFileSelect,
    clear,
  };
}
