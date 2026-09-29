import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const REPO = 'NiBa97/youtube-summaries'

async function github(ref: string): Promise<{ sha: string; date: string } | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${ref}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const c = (await res.json()) as { sha: string; commit?: { committer?: { date?: string } } }
    return { sha: String(c.sha), date: String(c.commit?.committer?.date ?? '') }
  } catch {
    return null
  }
}

// Build version for the footer: short sha + commit time (ISO, formatted in the
// browser). Sources, in order:
//   1. VITE_GIT_SHA build arg (Coolify's SOURCE_COMMIT — but only when its
//      "Include Source Commit in Build" setting is on, so it is often empty).
//   2. local git checkout.
//   3. GitHub API: the given sha, else head of main. Container builds have no
//      .git, and the repo is public. Fails soft to 'unknown'.
async function resolveVersion() {
  let sha = (process.env.VITE_GIT_SHA ?? '').trim()
  let date = (process.env.VITE_GIT_DATE ?? '').trim()
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
      date = execSync('git log -1 --format=%cI', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      /* no git */
    }
  }
  if (!sha || !date) {
    const gh = await github(sha || 'main')
    if (gh) {
      sha = sha || gh.sha
      date = date || gh.date
    }
  }
  process.env.VITE_GIT_SHA = sha.slice(0, 7) || 'unknown'
  process.env.VITE_GIT_DATE = date
}

// https://vite.dev/config/
export default defineConfig(async () => {
  await resolveVersion()
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
  }
})
