import { vi } from 'vitest'
import { api } from '@/api'

type Api = typeof api
type Fn = (...args: never[]) => unknown
export type ApiStubs = { [K in keyof Api]?: { [M in keyof Api[K]]?: Fn } }

/**
 * Replaces API methods with test implementations for the current test; setup.ts restores
 * them afterwards. Methods not given here keep their real (network) implementation, so stub
 * everything a test exercises.
 */
export function stubApi(stubs: ApiStubs) {
    for(const [namespace, methods] of Object.entries(stubs)) {
        for(const [name, impl] of Object.entries(methods ?? {})) {
            const target = api[namespace as keyof Api] as Record<string, Fn>
            vi.spyOn(target, name).mockImplementation(impl as never)
        }
    }
}
