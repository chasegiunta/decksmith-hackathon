<script setup lang="ts" generic="T extends string">
const props = defineProps<{
  options: ReadonlyArray<{ value: T; label: string }>;
  label: string;
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <div
    class="grid rounded-lg bg-[#f1f3f6] p-1"
    :style="{
      gridTemplateColumns: `repeat(${props.options.length}, minmax(0, 1fr))`,
    }"
    role="group"
    :aria-label="label"
  >
    <button
      v-for="option in props.options"
      :key="option.value"
      type="button"
      class="cursor-pointer rounded-md px-2 py-2 text-[11px] font-medium text-[#7a8290] transition-[transform,background-color,color,box-shadow] duration-150 ease-snappy active:scale-[.97]"
      :class="{ 'bg-white text-[#252a33] shadow-sm': model === option.value }"
      :aria-pressed="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
