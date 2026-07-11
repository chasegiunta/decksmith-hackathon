<script setup lang="ts">
import { Check, ChevronDown, Palette } from '@lucide/vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { accentPresets, atmosphereOptions, themeOptions } from '@/lib/themes'
import type { DeckAtmosphere, TahtaVariant } from '@/types/deck'

const variant = defineModel<TahtaVariant>('variant', { required: true })
const accent = defineModel<string>('accent', { required: true })
const atmosphere = defineModel<DeckAtmosphere>('atmosphere', {
  required: true,
})
const logo = defineModel<string>('logo', { required: true })
const logoInvert = defineModel<boolean>('logoInvert', { required: true })
</script>

<template>
  <aside class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
    <div class="flex h-16 shrink-0 items-center gap-3 border-b border-[#e9ecf0] px-4">
      <span class="grid size-9 place-items-center rounded-xl bg-[#eef6ff] text-accent"
        ><Palette :size="17"
      /></span>
      <span
        ><strong class="block text-[14px] font-semibold text-[#252a33]">Design your deck</strong
        ><small class="mt-0.5 block text-[11px] text-[#929aa7]"
          >Changes appear in the preview</small
        ></span
      >
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <section class="min-w-0">
        <span class="text-[11px] font-semibold tracking-[0.08em] text-[#7b8491] uppercase"
          >Visual style</span
        >
        <div class="mt-3 grid grid-cols-2 gap-2.5">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            class="group cursor-pointer overflow-hidden rounded-xl border bg-white text-left transition-[transform,border-color,box-shadow] duration-150 ease-snappy hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(25,39,70,.10)] active:scale-[.97] motion-reduce:transform-none"
            :class="
              variant === option.value ? 'border-accent ring-2 ring-accent/15' : 'border-[#e2e6ec]'
            "
            :aria-pressed="variant === option.value"
            @click="variant = option.value"
          >
            <span
              class="relative block h-[62px] overflow-hidden p-2.5"
              :style="{ backgroundColor: option.canvas, color: option.ink }"
              ><span
                class="absolute top-2.5 right-2.5 size-2 rounded-full"
                :style="{ backgroundColor: option.accent }"
              ></span
              ><span class="block w-6 border-t" :style="{ borderColor: option.accent }"></span
              ><strong class="mt-2 block max-w-[90px] text-[10px] leading-[1.05] tracking-[-0.03em]"
                >A story worth sharing.</strong
              ><span
                class="absolute right-2.5 bottom-2 left-2.5 h-2 rounded-sm"
                :style="{ backgroundColor: option.surface }"
              ></span
            ></span>
            <span class="flex items-center justify-between gap-1.5 px-2.5 py-2"
              ><strong class="truncate text-[11px] font-semibold text-[#3d444f]">{{
                option.label
              }}</strong
              ><Check v-if="variant === option.value" class="shrink-0 text-accent" :size="13"
            /></span>
          </button>
        </div>
      </section>

      <section class="mt-6 grid content-start gap-5 border-t border-[#edf0f4] pt-5">
        <div>
          <span class="text-[11px] font-semibold tracking-[0.08em] text-[#7b8491] uppercase"
            >Brand color</span
          >
          <div class="mt-3 flex items-center gap-2">
            <label
              class="relative grid size-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-[#dce1e8] bg-white"
              ><span class="size-6 rounded-lg" :style="{ backgroundColor: accent }"></span
              ><input
                v-model="accent"
                class="absolute inset-0 cursor-pointer opacity-0"
                type="color"
                aria-label="Choose brand color" /></label
            ><input
              v-model="accent"
              class="h-10 min-w-0 flex-1 rounded-xl border border-[#dce1e8] bg-[#fbfcfd] px-2.5 font-mono text-[11px] text-[#343a44]"
              aria-label="Brand color value"
            />
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="color in accentPresets"
              :key="color"
              class="size-6 cursor-pointer rounded-full border-2 border-white shadow-[0_0_0_1px_#dce1e8] transition-transform duration-150 hover:scale-110 active:scale-90"
              :style="{ backgroundColor: color }"
              :aria-label="`Use ${color}`"
              @click="accent = color"
            ></button>
          </div>
        </div>

        <label
          class="grid content-start gap-2 text-[11px] font-semibold tracking-[0.08em] text-[#7b8491] uppercase"
          >Background<span class="relative"
            ><select
              v-model="atmosphere"
              class="h-10 w-full appearance-none rounded-xl border border-[#dce1e8] bg-[#fbfcfd] px-3 pr-8 text-[12px] font-normal tracking-normal text-[#343a44] normal-case"
            >
              <option v-for="option in atmosphereOptions" :key="option.value" :value="option.value">
                {{ option.label }} — {{ option.description }}
              </option></select
            ><ChevronDown
              class="pointer-events-none absolute top-3 right-2.5 text-[#9aa2ae]"
              :size="14" /></span
        ></label>

        <details class="border-t border-[#edf0f4] pt-4">
          <summary class="cursor-pointer text-[12px] font-medium text-[#5d6572]">
            Optional brand logo
          </summary>
          <div class="mt-3 grid gap-3">
            <input
              v-model="logo"
              class="h-10 rounded-xl border border-[#dce1e8] bg-[#fbfcfd] px-3 text-[12px] text-[#343a44]"
              placeholder="https://…/logo.svg"
            /><label
              class="flex items-center justify-between gap-3 text-[11px] leading-snug text-[#6f7885]"
              >Invert on dark slides<SwitchRoot
                v-model="logoInvert"
                class="relative h-[22px] w-[38px] shrink-0 cursor-pointer rounded-full bg-[#ccd2db] p-[3px] transition-colors duration-150 data-[state=checked]:bg-accent"
                ><SwitchThumb
                  class="block size-4 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-4" /></SwitchRoot
            ></label>
          </div>
        </details>
      </section>
    </div>
  </aside>
</template>
