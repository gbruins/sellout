import { afterEach, vi } from 'vitest'
import { config } from '@vue/test-utils'
import { i18n } from '@/plugins/i18n'

// Components render their text with $t(), so every mounted component gets the real messages
config.global.plugins = [i18n]

afterEach(() => {
    vi.restoreAllMocks()
})
