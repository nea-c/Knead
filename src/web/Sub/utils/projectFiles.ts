export function findKneadProjectPath(paths: readonly string[]): string | undefined {
  return paths.find(path => /\.kp$/i.test(path))
}

export function _selfCheckProjectFiles(): void {
  const selected = findKneadProjectPath([
    'C:\\projects\\notes.json',
    'C:\\projects\\song.KP',
    'C:\\projects\\ignored.kp.json',
  ])
  if (selected !== 'C:\\projects\\song.KP') {
    throw new Error(`.kp の抽出結果が不正です: ${String(selected)}`)
  }
  if (findKneadProjectPath(['project.kp.json']) !== undefined) {
    throw new Error('.kp 以外をプロジェクトとして扱っています')
  }
  console.log('projectFiles self-check OK')
}
