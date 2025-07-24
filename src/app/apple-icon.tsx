import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

// Image generation
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 120,
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '20px',
          fontWeight: 'bold',
          boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)',
        }}
      >
        F
      </div>
    ),
    {
      ...size,
    }
  )
}