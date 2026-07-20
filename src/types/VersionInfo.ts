type VersionInfo = {
  kind: string
  raw: string
}

type ReleaseVersionInfo = VersionInfo & {
  kind: 'release'
  major: number
  minor: number
  patch: number
}
export const compareReleaseVersionInfo = (a: ReleaseVersionInfo | undefined, b: ReleaseVersionInfo) => {
  if (a === undefined) return -b.major
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

type SnapshotVersionInfo = VersionInfo & {
  kind: 'snapshot'
  year: number
  releaseNumber: number
  letter: string
}
export const compareSnapshotVersionInfo = (a: SnapshotVersionInfo | undefined, b: SnapshotVersionInfo) => {
  if (a === undefined) return -b.year
  if (a.year !== b.year) return a.year - b.year
  if (a.releaseNumber !== b.releaseNumber) return a.releaseNumber - b.releaseNumber
  return a.letter.localeCompare(b.letter)
}

type PreReleaseVersionInfo = VersionInfo & {
  kind: 'pre-release'
  major: number
  minor: number
  patch: number
  releaseNumber: number
}
export const comparePreReleaseVersionInfo = (a: PreReleaseVersionInfo | undefined, b: PreReleaseVersionInfo) => {
  if (a === undefined) return -b.major
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  return a.releaseNumber - b.releaseNumber
}

type ReleaseCandidateVersionInfo = VersionInfo & {
  kind: 'release-candidate'
  major: number
  minor: number
  patch: number
  releaseNumber: number
}
export const compareReleaseCandidateVersionInfo = (a: ReleaseCandidateVersionInfo | undefined, b: ReleaseCandidateVersionInfo) => {
  if (a === undefined) return -b.major
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  return a.releaseNumber - b.releaseNumber
}

export type VersionInfoType = ReleaseVersionInfo | SnapshotVersionInfo | PreReleaseVersionInfo | ReleaseCandidateVersionInfo

export const parseVersion = (raw: string) => {
  const major = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(raw)
  if (major) {
    return {
      kind: 'release',
      raw,
      major: Number(major[1]),
      minor: Number(major[2]),
      patch: major[3] ? Number(major[3]) : 0,
    } as ReleaseVersionInfo
  }

  const snapshot = /^(\d+)w(\d+)(.+)$/.exec(raw)
  if (snapshot) {
    return {
      kind: 'snapshot',
      raw,
      year: Number(snapshot[1]),
      releaseNumber: Number(snapshot[2]),
      letter: snapshot[3],
    } as SnapshotVersionInfo
  }

  // Mojang changed snapshot IDs from 26wXXa to 26.X-snapshot-N in 2026.
  const numberedSnapshot = /^(\d+)\.(\d+)-snapshot-(\d+)$/.exec(raw)
  if (numberedSnapshot) {
    return {
      kind: 'snapshot',
      raw,
      year: Number(numberedSnapshot[1]),
      releaseNumber: Number(numberedSnapshot[2]) * 1000 + Number(numberedSnapshot[3]),
      letter: 'z',
    } as SnapshotVersionInfo
  }

  const preRelease = /^(\d+)\.(\d+)(?:\.(\d+))?-pre-?(\d+)$/.exec(raw)
  if (preRelease) {
    return {
      kind: 'pre-release',
      raw,
      major: Number(preRelease[1]),
      minor: Number(preRelease[2]),
      patch: preRelease[3] ? Number(preRelease[3]) : 0,
      releaseNumber: Number(preRelease[4]),
    } as PreReleaseVersionInfo
  }

  const releaseCandidate = /^(\d+)\.(\d+)(?:\.(\d+))?-rc-?(\d+)$/.exec(raw)
  if (releaseCandidate) {
    return {
      kind: 'release-candidate',
      raw,
      major: Number(releaseCandidate[1]),
      minor: Number(releaseCandidate[2]),
      patch: releaseCandidate[3] ? Number(releaseCandidate[3]) : 0,
      releaseNumber: Number(releaseCandidate[4]),
    } as ReleaseCandidateVersionInfo
  }

  return undefined
}

export const isAboveVersion = (targetVersion: VersionInfoType | undefined, searchVersion: VersionInfoType): boolean => {
  if (targetVersion === undefined) return false

  switch (searchVersion.kind) {
    case 'release':
      if (targetVersion.kind !== 'release') return false
      return compareReleaseVersionInfo(targetVersion, searchVersion) >= 0
    case 'release-candidate':
      if (targetVersion.kind !== 'release-candidate') return false
      return compareReleaseCandidateVersionInfo(targetVersion, searchVersion) >= 0
    case 'pre-release':
      if (targetVersion.kind !== 'pre-release') return false
      return comparePreReleaseVersionInfo(targetVersion, searchVersion) >= 0
    case 'snapshot':
      if (targetVersion.kind !== 'snapshot') return false
      if (compareSnapshotVersionInfo(targetVersion, searchVersion) >= 0 && searchVersion.letter == 'b') return /^[c-z]$/.test(targetVersion.letter)
      return compareSnapshotVersionInfo(targetVersion, searchVersion) >= 0
  }
}
