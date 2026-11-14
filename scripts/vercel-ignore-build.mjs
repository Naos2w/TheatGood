/**
 * Runs inside Vercel's Ignored Build Step.
 * Exit 0 -> skip build. Exit 1 -> build normally.
 * Never skip on ambiguous Git history: no parent or unknown input means build.
 *
 * Branch restrictions are also enforced by vercel.json git.deploymentEnabled,
 * which prevents unwanted PR branch deployments before using any build slots.
 */
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import process from 'node:process'

const branch = process.env.VERCEL_GIT_COMMIT_REF
const deployableBranches = new Set(['develop', 'staging', 'main'])

if (branch && !deployableBranches.has(branch)) {
  console.log(`Skip: ${branch} is not a deployment branch`)
  process.exit(0)
}

let changedFiles
try {
  changedFiles = execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD', '--'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split(/\r?\n/)
    .filter(Boolean)
} catch {
  console.log('No reliable parent diff available, continue build')
  process.exit(1)
}

const onlyDocs =
  changedFiles.length > 0 &&
  changedFiles.every(
    (path) => path.endsWith('.md') || path.startsWith('docs/') || path.startsWith('.github/'),
  )

if (onlyDocs) {
  console.log(`Skip: documentation/CI-only change (${changedFiles.length} file(s))`)
  process.exit(0)
}

console.log(`Build: code or configuration changed (${changedFiles.length} file(s))`)
process.exit(1)
