import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { t, useT, SUPPORTED_LOCALES } from './index'
import { useUiStore } from '../store/useUiStore'

afterEach(cleanup)

// ---------------------------------------------------------------------------
// 10.1 — t() pure function: EN catalog resolution
// ---------------------------------------------------------------------------

describe('t() — EN catalog (10.1)', () => {
  it('resolves a top-level key', () => {
    expect(t('app.title')).toBe('Japan PR Navigator')
  })

  it('resolves a nested key', () => {
    expect(t('questionnaire.back')).toBe('Back')
  })

  it('interpolates variables', () => {
    expect(t('questionnaire.progress', { current: 3, total: 8 })).toBe('Question 3 of 8')
  })

  it('returns the key itself when missing (no crash)', () => {
    expect(t('nonexistent.key.path')).toBe('nonexistent.key.path')
  })

  it('resolves content labelKey format: q.* → questions.*', () => {
    expect(t('q.visa_type.label')).toBe('What is your current visa type?')
  })

  it('resolves content labelKey format: q.*.opt.* → questions.*.options.*', () => {
    expect(t('q.visa_type.opt.hsp')).toMatch(/Highly Skilled/)
  })

  it('resolves track.* → tracks.*', () => {
    expect(t('track.hsp_1yr.title')).toMatch(/Highly Skilled Professional/)
  })

  it('resolves milestone.* → milestones.*', () => {
    expect(t('milestone.personal_docs')).toBe('Personal Documents')
  })
})

// ---------------------------------------------------------------------------
// 10.2 — t() content key resolution + fallback
// ---------------------------------------------------------------------------

describe('t() — content key resolution (10.2)', () => {
  it('resolves status keys', () => {
    expect(t('status.have')).toBe('Have it')
    expect(t('status.not-started')).toBe('Not started')
  })

  it('resolves docpanel keys', () => {
    expect(t('docpanel.markHave')).toBe('I have this document')
  })

  it('resolves questmap keys', () => {
    expect(t('questmap.milestoneComplete')).toBe('Milestone complete!')
  })

  it('resolves exportImport keys', () => {
    expect(t('exportImport.title')).toBe('Data & Settings')
  })

  it('falls back to key string for a truly missing key', () => {
    const result = t('this.key.does.not.exist')
    expect(result).toBe('this.key.does.not.exist')
  })
})

// ---------------------------------------------------------------------------
// 10.3 — JA locale: key resolution and EN fallback
// ---------------------------------------------------------------------------

describe('t() — JA locale (10.3)', () => {
  it('resolves app.title in Japanese', () => {
    expect(t('app.title', undefined, 'ja')).toBe('日本永住ナビゲーター')
  })

  it('resolves questionnaire.back in Japanese', () => {
    expect(t('questionnaire.back', undefined, 'ja')).toBe('戻る')
  })

  it('resolves questmap.milestoneComplete in Japanese', () => {
    expect(t('questmap.milestoneComplete', undefined, 'ja')).toBe('マイルストーン達成！')
  })

  it('resolves status.have in Japanese', () => {
    expect(t('status.have', undefined, 'ja')).toBe('取得済み')
  })

  it('falls back to EN for a key missing from JA catalog', () => {
    // This key exists in EN but not in JA — should fall back gracefully
    const result = t('results.vars.years', undefined, 'ja')
    // Either JA or EN value — must not return the raw key
    expect(result).not.toBe('results.vars.years')
    expect(result.length).toBeGreaterThan(0)
  })

  it('interpolates variables in JA', () => {
    const result = t('questionnaire.progress', { current: 2, total: 8 }, 'ja')
    expect(result).toMatch(/2/)
    expect(result).toMatch(/8/)
  })
})

// ---------------------------------------------------------------------------
// SUPPORTED_LOCALES
// ---------------------------------------------------------------------------

describe('SUPPORTED_LOCALES', () => {
  it('contains en and ja', () => {
    expect(SUPPORTED_LOCALES).toContain('en')
    expect(SUPPORTED_LOCALES).toContain('ja')
  })
})

// ---------------------------------------------------------------------------
// 10.3 — useT() hook reacts to locale changes
// ---------------------------------------------------------------------------

describe('useT() — locale reactivity (10.3)', () => {
  beforeEach(() => {
    useUiStore.setState({ locale: 'en', theme: 'system', lastRoute: '/' })
  })

  it('returns EN translation when locale is en', () => {
    let result = ''
    function TestComp() {
      const t = useT()
      result = t('app.title')
      return null
    }
    render(createElement(TestComp))
    expect(result).toBe('Japan PR Navigator')
  })

  it('returns JA translation after locale switches to ja', () => {
    let result = ''
    function TestComp() {
      const t = useT()
      result = t('app.title')
      return null
    }
    render(createElement(TestComp))
    expect(result).toBe('Japan PR Navigator')

    act(() => {
      useUiStore.getState().setLocale('ja')
    })
    expect(result).toBe('日本永住ナビゲーター')
  })

  it('falls back to EN when a key is missing in JA', () => {
    useUiStore.setState({ locale: 'ja', theme: 'system', lastRoute: '/' })
    let result = ''
    function TestComp() {
      const t = useT()
      result = t('results.vars.years')
      return null
    }
    render(createElement(TestComp))
    // Must not return the key itself — either JA or EN value
    expect(result).not.toBe('results.vars.years')
  })
})
