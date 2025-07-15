/**
 * PNG Metadata Reader - 前端直接读取PNG文件的metadata
 *
 * PNG文件格式：
 * - PNG signature: 8字节
 * - Chunks: 每个chunk包含长度(4字节) + 类型(4字节) + 数据 + CRC(4字节)
 * - 文本信息存储在tEXt、zTXt、iTXt chunks中
 * - 优化：只读取metadata chunks，不读取图像数据
 */

interface PngChunk {
  length: number
  type: string
  data: Uint8Array
  crc: number
}

interface PngMetadata {
  success: boolean
  metadata: Record<string, any>
  has_metadata: boolean
  error?: string
}

/**
 * 从ArrayBuffer中读取4字节big-endian整数
 */
function readUint32BE(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3]
  )
}

/**
 * 从ArrayBuffer中读取字符串
 */
function readString(
  buffer: Uint8Array,
  offset: number,
  length: number
): string {
  return new TextDecoder('utf-8').decode(buffer.slice(offset, offset + length))
}

/**
 * 检查PNG文件头
 */
function isPNG(buffer: Uint8Array): boolean {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buffer.length < 8) return false

  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== pngSignature[i]) return false
  }
  return true
}

/**
 * 解析PNG chunks，只解析metadata相关的chunks
 */
function parsePNGMetadataChunks(buffer: Uint8Array): PngChunk[] {
  const chunks: PngChunk[] = []
  let offset = 8 // 跳过PNG signature

  while (offset < buffer.length - 8) {
    if (offset + 8 > buffer.length) break

    const length = readUint32BE(buffer, offset)
    const type = readString(buffer, offset + 4, 4)

    // 如果没有足够的数据来读取完整的chunk，退出循环
    if (offset + 12 + length > buffer.length) break

    // 如果遇到图像数据chunk，说明metadata部分已经结束，可以停止解析
    if (type === 'IDAT') {
      console.log('Reached IDAT chunk, stopping metadata parsing')
      break
    }

    const data = buffer.slice(offset + 8, offset + 8 + length)
    const crc = readUint32BE(buffer, offset + 8 + length)

    chunks.push({ length, type, data, crc })

    offset += 12 + length

    // 如果遇到IEND chunk，停止解析
    if (type === 'IEND') break
  }

  return chunks
}

/**
 * 解析tEXt chunk
 */
function parseTextChunk(data: Uint8Array): [string, string] | null {
  try {
    const text = new TextDecoder('latin1').decode(data)
    const nullIndex = text.indexOf('\0')
    if (nullIndex === -1) return null

    const keyword = text.substring(0, nullIndex)
    const value = text.substring(nullIndex + 1)

    return [keyword, value]
  } catch (error) {
    console.error('Error parsing tEXt chunk:', error)
    return null
  }
}

/**
 * 解析zTXt chunk (压缩文本)
 */
function parseZTextChunk(data: Uint8Array): [string, string] | null {
  try {
    const text = new TextDecoder('latin1').decode(data)
    const nullIndex = text.indexOf('\0')
    if (nullIndex === -1) return null

    const keyword = text.substring(0, nullIndex)
    // 跳过compression method byte
    const compressedData = data.slice(nullIndex + 2)

    // 这里需要zlib解压缩，为了简化我们先跳过zTXt
    console.warn('zTXt chunk found but decompression not implemented')
    return [keyword, '[Compressed Text - Not Implemented]']
  } catch (error) {
    console.error('Error parsing zTXt chunk:', error)
    return null
  }
}

/**
 * 解析iTXt chunk (国际化文本)
 */
function parseITextChunk(data: Uint8Array): [string, string] | null {
  try {
    let offset = 0
    const text = new TextDecoder('utf-8').decode(data)

    // 查找第一个null字符（keyword结束）
    const keywordEnd = text.indexOf('\0')
    if (keywordEnd === -1) return null

    const keyword = text.substring(0, keywordEnd)
    offset = keywordEnd + 1

    // 跳过compression flag和compression method
    offset += 2

    // 查找language tag结束
    const languageEnd = text.indexOf('\0', offset)
    if (languageEnd === -1) return null
    offset = languageEnd + 1

    // 查找translated keyword结束
    const translatedEnd = text.indexOf('\0', offset)
    if (translatedEnd === -1) return null
    offset = translatedEnd + 1

    // 剩余的就是文本内容
    const value = text.substring(offset)

    return [keyword, value]
  } catch (error) {
    console.error('Error parsing iTXt chunk:', error)
    return null
  }
}

/**
 * 渐进式读取PNG文件，只读取metadata部分
 */
async function readPNGHeaderAndMetadata(filePath: string): Promise<Uint8Array> {
  let totalBuffer = new Uint8Array(0)
  let offset = 0
  const chunkSize = 8192 // 每次读取8KB
  let maxReadSize = 512 * 1024 // 最大读取512KB，避免无限读取

  try {
    while (offset < maxReadSize) {
      // 使用Range请求读取特定字节范围
      const endByte = Math.min(offset + chunkSize - 1, maxReadSize - 1)
      const response = await fetch(filePath, {
        headers: { Range: `bytes=${offset}-${endByte}` },
      })

      if (!response.ok) {
        if (response.status === 416 || response.status === 206) {
          // 已经读取到文件末尾或完成部分内容读取
          break
        }
        throw new Error(`Failed to fetch file: ${response.status}`)
      }

      const chunk = await response.arrayBuffer()
      if (chunk.byteLength === 0) break

      // 合并缓冲区
      const newBuffer = new Uint8Array(totalBuffer.length + chunk.byteLength)
      newBuffer.set(totalBuffer)
      newBuffer.set(new Uint8Array(chunk), totalBuffer.length)
      totalBuffer = newBuffer

      // 检查是否为PNG文件（第一次读取时）
      if (offset === 0 && !isPNG(totalBuffer)) {
        throw new Error('Not a valid PNG file')
      }

      // 尝试解析当前数据，看是否已经包含足够的metadata
      if (totalBuffer.length >= 8) {
        let parseOffset = 8 // 跳过PNG signature
        let foundIDAT = false
        let hasValidChunks = false

        while (parseOffset < totalBuffer.length - 8) {
          if (parseOffset + 8 > totalBuffer.length) break

          const length = readUint32BE(totalBuffer, parseOffset)
          if (parseOffset + 12 + length > totalBuffer.length) {
            // 当前chunk还没有完全下载，继续读取
            break
          }

          const type = readString(totalBuffer, parseOffset + 4, 4)
          hasValidChunks = true

          if (type === 'IDAT') {
            foundIDAT = true
            console.log(
              `Found IDAT at offset ${parseOffset}, stopping progressive read`
            )
            break
          }

          parseOffset += 12 + length
        }

        // 如果找到了IDAT或者已经有有效的chunks，可以停止读取
        if (
          foundIDAT ||
          (hasValidChunks && parseOffset >= totalBuffer.length - 8)
        ) {
          console.log(
            `Progressive read complete. Total read: ${totalBuffer.length} bytes`
          )
          break
        }
      }

      offset += chunk.byteLength

      // 如果读取的数据少于请求的数据，说明已经到文件末尾
      if (chunk.byteLength < chunkSize) {
        break
      }
    }

    return totalBuffer
  } catch (error) {
    console.error('Error during progressive read:', error)
    throw error
  }
}

/**
 * 从PNG文件中提取metadata (优化版本)
 */
export async function readPNGMetadata(filePath: string): Promise<PngMetadata> {
  try {
    console.log('Starting PNG metadata extraction for:', filePath)

    // 渐进式读取PNG文件的头部和metadata部分
    const buffer = await readPNGHeaderAndMetadata(filePath)

    console.log(`Read ${buffer.length} bytes for metadata extraction`)

    // 解析PNG chunks (只解析metadata相关的)
    const chunks = parsePNGMetadataChunks(buffer)
    const metadata: Record<string, any> = {}

    console.log(`Found ${chunks.length} chunks before image data`)

    // 处理文本chunks
    for (const chunk of chunks) {
      let result: [string, string] | null = null

      switch (chunk.type) {
        case 'tEXt':
          result = parseTextChunk(chunk.data)
          break
        case 'zTXt':
          result = parseZTextChunk(chunk.data)
          break
        case 'iTXt':
          result = parseITextChunk(chunk.data)
          break
      }

      if (result) {
        const [key, value] = result
        try {
          // 尝试解析JSON
          if (value.startsWith('{') || value.startsWith('[')) {
            metadata[key] = JSON.parse(value)
          } else {
            metadata[key] = value
          }
        } catch (e) {
          metadata[key] = value
        }
      }
    }

    console.log(`Extracted ${Object.keys(metadata).length} metadata entries`)

    return {
      success: true,
      metadata,
      has_metadata: Object.keys(metadata).length > 0,
    }
  } catch (error) {
    console.error('Error reading PNG metadata:', error)
    return {
      success: false,
      metadata: {},
      has_metadata: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 检查文件是否为PNG格式 (优化版本)
 */
export async function isPNGFile(filePath: string): Promise<boolean> {
  try {
    const response = await fetch(filePath, {
      headers: { Range: 'bytes=0-7' }, // 只获取前8字节
    })

    if (!response.ok) return false

    const arrayBuffer = await response.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    return isPNG(buffer)
  } catch (error) {
    console.error('Error checking PNG file:', error)
    return false
  }
}
