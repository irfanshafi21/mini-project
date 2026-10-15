export const plainText = text => String(text || '').replace(/^\s*#{1,6}\s*/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim()
