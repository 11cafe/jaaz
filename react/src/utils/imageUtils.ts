/**
 * Simple image processing utilities
 */

import { dataURLToFile } from '@/lib/utils'

interface ProcessedImage {
  url: string
  filename: string
}

/**
 * Convert file to base64 data URL
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () =>
      reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

/**
 * Compress large image (>2MB) to ~1MB
 */
function compressLargeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      try {
        // Calculate new dimensions (max 2048px)
        let { width, height } = img
        const maxSize = 2048

        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height)

        // Try different quality levels to get under 2MB
        let quality = 1
        let dataUrl: string
        let attempts = 0

        do {
          dataUrl = canvas.toDataURL('image/jpeg', quality)
          const size = Math.round(dataUrl.length * 0.75) // Estimate size

          // Stop if under 2MB or tried 5 times
          if (size <= 2048 * 1024 || attempts >= 5) {
            resolve(dataUrl)
            return
          }

          quality *= 0.8
          attempts++
        } while (attempts < 5)

        resolve(dataUrl)
      } catch (error) {
        reject(new Error(`Failed to compress image: ${file.name}`))
      }
    }

    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))

    // Create object URL for the image
    const objectUrl = URL.createObjectURL(file)
    const originalOnload = img.onload
    img.onload = function (ev: Event) {
      URL.revokeObjectURL(objectUrl)
      return originalOnload?.call(this, ev)
    }

    img.src = objectUrl
  })
}

/**
 * Compress image file and return compressed File object
 */
export async function compressImageFile(file: File): Promise<File> {
  // Check file size (2MB = 2048KB)
  const fileSizeKB = file.size / 1024

  // If file is small enough, return as is
  if (fileSizeKB <= 2048) {
    return file
  }

  console.log(
    `Compressing large image: ${file.name} (${Math.round(fileSizeKB)}KB)`
  )

  try {
    const compressedDataURL = await compressLargeImage(file)
    const compressedFile = dataURLToFile(compressedDataURL, file.name)

    console.log(
      `Image compressed: ${file.name} (${Math.round(fileSizeKB)}KB → ${Math.round(compressedFile.size / 1024)}KB)`
    )

    return compressedFile
  } catch (error) {
    console.warn(
      `Failed to compress image ${file.name}, using original:`,
      error
    )
    return file
  }
}

/**
 * Process image files - compress only if larger than 2MB
 */
export async function processImageFiles(
  files: File[]
): Promise<ProcessedImage[]> {
  const results = await Promise.allSettled(
    files.map(async (file) => {
      // Check file size (2MB = 2048KB)
      const fileSizeKB = file.size / 1024

      let url: string
      if (fileSizeKB > 2048) {
        // Large file - compress it
        console.log(
          `[Silent] Compressing large image: ${file.name} (${Math.round(fileSizeKB)}KB)`
        )
        url = await compressLargeImage(file)
      } else {
        // Small file - use as is
        url = await fileToBase64(file)
      }

      return {
        url,
        filename: file.name,
      }
    })
  )

  // Extract successful results
  const processedImages: ProcessedImage[] = []
  const errors: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      processedImages.push(result.value)
    } else {
      errors.push(`${files[index].name}: ${result.reason.message}`)
    }
  })

  // Handle errors
  if (errors.length > 0 && processedImages.length === 0) {
    throw new Error(`All images failed to process:\n${errors.join('\n')}`)
  }

  if (errors.length > 0) {
    console.warn('Some images failed to process:', errors)
  }

  return processedImages
}
