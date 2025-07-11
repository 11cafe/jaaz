import { compressImageFile, fileToBase64 } from '@/utils/imageUtils'
import { BASE_API_URL } from '../constants'
import { authenticatedFetch } from './auth'

export async function uploadImage(
  file: File
): Promise<{ file_id: string; width: number; height: number; url: string }> {
  // Compress image before upload
  const compressedFile = await compressImageFile(file)

  const formData = new FormData()
  formData.append('file', compressedFile)
  const response = await fetch('/api/upload_image', {
    method: 'POST',
    body: formData,
  })
  return await response.json()
}

/**
 * Upload image to Jaaz server
 * @param file - Image file to upload
 * @returns Promise with the uploaded image URL
 */
export async function uploadImageToJaaz(file: File): Promise<string> {
  try {
    // Compress image before upload
    const compressedFile = await compressImageFile(file)

    // Convert file to base64
    const base64Data = await fileToBase64(compressedFile)

    // Prepare request body
    const requestBody = {
      base64Data: base64Data.split(',')[1], // Remove data:image/jpeg;base64, prefix
      fileName: compressedFile.name,
      contentType: compressedFile.type,
    }

    // Make authenticated request to Jaaz cloud API
    const response = await authenticatedFetch(
      `${BASE_API_URL}/api/v1/image/upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error || `Upload failed with status ${response.status}`
      )
    }

    const result = await response.json()

    if (!result.success || !result.data?.s3Url) {
      throw new Error(result.error || 'Upload failed - no URL returned')
    }

    return result.data.s3Url
  } catch (error) {
    console.error('Failed to upload image to Jaaz:', error)
    throw error
  }
}
