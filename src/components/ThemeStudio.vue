<script setup lang="ts">
import { Check, ChevronDown, Palette } from "@lucide/vue";
import { accentPresets, atmosphereOptions, themeOptions } from "@/lib/themes";
import type { DeckAtmosphere, TahtaVariant } from "@/types/deck";

const variant = defineModel<TahtaVariant>("variant", { required: true });
const accent = defineModel<string>("accent", { required: true });
const atmosphere = defineModel<DeckAtmosphere>("atmosphere", {
  required: true,
});
</script>

<template>
  <aside
    class="flex h-36 shrink-0 flex-col overflow-hidden border-b border-[#e5e9ef] bg-white"
  >
    <div class="flex h-9 pt-3 shrink-0 items-center gap-2.5 px-3">
      <span
        class="grid size-7 place-items-center rounded-full bg-[#eef6ff] text-accent"
      >
        <Palette :size="14" />
      </span>
      <strong class="text-[13px] font-semibold text-[#252a33]"
        >Design your deck</strong
      >
      <small class="text-[10px] text-[#929aa7]">Changes appear live</small>
    </div>

    <div
      class="min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 pb-3 pt-2"
    >
      <div class="flex h-full min-w-max snap-x items-stretch gap-2.5">
        <section
          class="flex w-40 shrink-0 snap-start flex-col justify-between rounded-xl border border-[#e1e5eb] bg-[#fbfcfd] p-2.5"
          aria-label="Brand color"
        >
          <div class="flex items-center justify-between gap-2">
            <span
              class="text-[10px] font-semibold tracking-[0.06em] text-[#747d8a] uppercase"
              >Brand color</span
            >
            <label
              class="relative grid size-7 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-[#d9dee6] bg-white transition-transform duration-150 ease-snappy active:scale-[.94]"
            >
              <span
                class="size-4 rounded-md"
                :style="{ backgroundColor: accent }"
              ></span>
              <input
                v-model="accent"
                class="absolute inset-0 cursor-pointer opacity-0"
                type="color"
                aria-label="Choose brand color"
              />
            </label>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              v-for="color in accentPresets"
              :key="color"
              type="button"
              class="size-4.5 cursor-pointer rounded-full border-2 border-white shadow-[0_0_0_1px_#d7dce4] transition-transform duration-150 ease-snappy hover:scale-110 active:scale-90"
              :style="{ backgroundColor: color }"
              :aria-label="`Use ${color}`"
              @click="accent = color"
            ></button>
          </div>
        </section>

        <label
          class="grid w-29 shrink-0 snap-start content-between rounded-xl border border-[#e1e5eb] bg-[#fbfcfd] p-2.5 text-[10px] font-semibold tracking-[0.06em] text-[#747d8a] uppercase"
        >
          Background
          <span class="relative">
            <select
              v-model="atmosphere"
              class="h-8 w-full appearance-none rounded-lg border border-[#dce1e8] bg-white px-2 pr-6 text-[11px] font-medium tracking-normal text-[#343a44] normal-case outline-none focus:border-accent"
            >
              <option
                v-for="option in atmosphereOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <ChevronDown
              class="pointer-events-none absolute top-2 right-1.5 text-[#9aa2ae]"
              :size="12"
            />
          </span>
        </label>

        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          class="group w-38 max-w-40 shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl border bg-white text-left transition-[transform,border-color,box-shadow] duration-150 ease-snappy hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(25,39,70,.10)] active:scale-[.97] motion-reduce:transform-none"
          :class="
            variant === option.value
              ? 'border-accent ring-2 ring-accent/15'
              : 'border-[#e1e5eb]'
          "
          :aria-pressed="variant === option.value"
          @click="variant = option.value"
        >
          <span
            class="relative block h-12 overflow-hidden p-2"
            :style="{ backgroundColor: option.canvas, color: option.ink }"
          >
            <span
              class="absolute top-2 right-2 size-1.5 rounded-full"
              :style="{ backgroundColor: option.accent }"
            ></span>
            <span
              class="block w-5 border-t"
              :style="{ borderColor: option.accent }"
            ></span>
            <strong
              class="mt-1.5 block max-w-24 text-[9px] leading-[1.05] tracking-[-0.03em]"
            >
              A story worth sharing.
            </strong>
            <span
              class="absolute right-2 bottom-1.5 left-2 h-1.5 rounded-sm"
              :style="{ backgroundColor: option.surface }"
            ></span>
          </span>
          <span class="flex h-7 items-center justify-between gap-1.5 px-2.5">
            <strong class="truncate text-[10px] font-semibold text-[#3d444f]">{{
              option.label
            }}</strong>
            <Check
              v-if="variant === option.value"
              class="shrink-0 text-accent"
              :size="12"
            />
          </span>
        </button>
      </div>
    </div>
  </aside>
</template>
