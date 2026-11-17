import { CanvasTexture, SRGBColorSpace } from 'three'

/**
 * An entirely original, generic projection placeholder. No cinema stills,
 * film artwork, third-party screenshots or copyrighted assets are embedded.
 */
export function createCinemaScreenTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 576
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create the cinema projection texture')

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height)
  sky.addColorStop(0, '#253958')
  sky.addColorStop(0.49, '#64859a')
  sky.addColorStop(0.73, '#d7a17c')
  sky.addColorStop(1, '#293d50')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1024, 576)

  const light = ctx.createRadialGradient(720, 290, 12, 720, 290, 290)
  light.addColorStop(0, '#fff6d6')
  light.addColorStop(0.17, '#f1d7adcc')
  light.addColorStop(0.58, '#f2b89622')
  light.addColorStop(1, '#ffd2a400')
  ctx.fillStyle = light
  ctx.fillRect(390, 0, 640, 576)

  ctx.fillStyle = '#40586b'
  ctx.beginPath()
  ctx.moveTo(0, 350)
  ctx.lineTo(110, 320)
  ctx.lineTo(237, 365)
  ctx.lineTo(352, 273)
  ctx.lineTo(504, 362)
  ctx.lineTo(672, 304)
  ctx.lineTo(821, 368)
  ctx.lineTo(929, 301)
  ctx.lineTo(1024, 342)
  ctx.lineTo(1024, 576)
  ctx.lineTo(0, 576)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#213449'
  ctx.beginPath()
  ctx.moveTo(0, 470)
  ctx.lineTo(176, 420)
  ctx.lineTo(320, 459)
  ctx.lineTo(495, 397)
  ctx.lineTo(678, 463)
  ctx.lineTo(804, 430)
  ctx.lineTo(1024, 476)
  ctx.lineTo(1024, 576)
  ctx.lineTo(0, 576)
  ctx.closePath()
  ctx.fill()

  const vignette = ctx.createRadialGradient(510, 245, 185, 510, 265, 650)
  vignette.addColorStop(0, '#08111b00')
  vignette.addColorStop(1, '#08111b88')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, 1024, 576)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 2
  return texture
}
