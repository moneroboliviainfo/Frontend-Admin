export type BannerType = 'desktop' | 'mobile'
export type BannerGender = 'male' | 'female'

export interface Banner {
  id: number
  type: BannerType
  gender: BannerGender
  video: string
}

export interface UpdateBannerPayload {
  video: string
}
