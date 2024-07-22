
export interface NetworkConfig {
  protocol: string,
  ip: string,
  port?: number,
  networkID: number,
  hrp: string
}

export const localflare: NetworkConfig = {
  protocol: 'http',
  ip: 'localhost',
  port: 9650,
  networkID: 162,
  hrp: 'localflare'
}

export const local: NetworkConfig = {
  protocol: 'http',
  ip: 'localhost',
  port: 9650,
  networkID: 4294967295,
  hrp: 'local'
}

export const coston: NetworkConfig = {
  protocol: 'https',
  ip: 'coston.flare.rocks',
  networkID: 7,
  hrp: 'coston'
}

export const costwo: NetworkConfig = {
  protocol: 'https',
  ip: 'coston2-api.flare.networkkkkk',
  networkID: 114,
  hrp: 'costwo'
}

export const songbird: NetworkConfig = {
  protocol: 'https',
  ip: 'songbird-api.flare.network',
  networkID: 5,
  hrp: 'songbird'
}

export const flare: NetworkConfig = {
  protocol: 'https',
  ip: 'flare-api.flare.network',
  networkID: 14,
  hrp: 'flare'
}
