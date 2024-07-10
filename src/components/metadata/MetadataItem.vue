<template>
  <div
    class="metadata-item"
    :class="{ expand: expand }"
    :style="{ marginLeft: `${(item.level + 1) * 25}px` }"
    :block-id="item.id.slice(8)"
    v-if="Object.keys(entriesToDisplay).length > 0"
    ref="$metadataItem"
  >
    <div class="metadata-header">
      <div
          class="fold-button"
          @click="expand = !expand"
      >
        <Triangle></Triangle>
      </div>
      <div class="bullet">
        <Circle></Circle>
      </div>
      <div class="header-title" @click="expand = !expand">
        {{ Object.keys(entriesToDisplay).length }} Properties
      </div>
    </div>
    <div
      class="metadata-entry"
      v-if="expand"
      v-for="(entry, index) in entriesToDisplay"
      :key="index"
      :entrykey="entry.key"
      :entrytype="entry.type"
    >
      <div class="metadata-key">
        <div class="type-icon">
          <Hash v-if="entry.type == 'number'"></Hash>
          <Text v-else-if="entry.type == 'text'"></Text>
        </div>
        <TextField
          :value="entry.key"
          @update="(value) => onKeyUpdated(entry.key, value)"
          @delete-empty="onDeleteEntry(entry.key)"
        ></TextField>
      </div>
      <div class="metadata-value">
        <div class="bullet">
          <Circle></Circle>
        </div>
        <TextField
          v-if="entry.type == 'text'"
          :value="entry.value"
          @update="(value) => onValueUpdated(entry.key, value)"
        ></TextField>
        <NumberField
          v-else-if="entry.type == 'number'"
          :value="entry.value"
          @update="(value) => onValueUpdated(entry.key, value)"
        ></NumberField>
      </div>
    </div>
    <div
        v-if="expand"
        class="add-new-property"
        @click="addNewProperty">
      + Add new property
    </div>
  </div>
</template>

<script setup lang="ts">
import type {BlockTree} from "@/state/block-tree";
import type {MetadataDisplayItem} from "@/state/ui-misc";
import {computed, onMounted, onUnmounted, ref} from "vue";
import {Triangle, Circle, Hash, Text} from "lucide-vue-next";
import {useAppState} from "@/state/state";
import TextField from "@/components/metadata/TextField.vue";
import NumberField from "@/components/metadata/NumberField.vue";

const props = defineProps<{
  blockTree: BlockTree;
  item: MetadataDisplayItem;
}>();

const s = useAppState();
const expand = ref(false);
const $metadataItem = ref<HTMLElement | null>(null);

const entriesToDisplay = computed(() => {
  const metadata = props.item.metadata;
  if (!metadata.specs) return {};
  const result: any = [];
  for (const key in metadata.specs) {
    const spec = metadata.specs[key];
    const value = metadata[key];
    result.push({ key, ...spec, value });
  }
  // console.log(metadata);
  return result;
});

const onKeyUpdated = (oldKey: string, newKey: string) => {
  const metadata = props.item.metadata;
  const blockId = props.item.id.slice(8); // 剪掉前面的 metadata
  const value = metadata[oldKey];
  const spec = metadata.specs![oldKey];
  delete metadata[oldKey];
  delete metadata.specs![oldKey];
  metadata[newKey] = value;
  metadata.specs![newKey] = spec;
  s.changeMetadata(blockId, metadata);
}

const onDeleteEntry = (key: string) => {
  const metadata = props.item.metadata;
  const blockId = props.item.id.slice(8); // 剪掉前面的 metadata
  delete metadata[key];
  delete metadata.specs![key];
  s.changeMetadata(blockId, metadata);
}

const onValueUpdated = (key: string, value: any) => {
  const metadata = props.item.metadata;
  const blockId = props.item.id.slice(8); // 剪掉前面的 metadata
  metadata[key] = value;
  s.changeMetadata(blockId, metadata);
}

const addNewProperty = () => {
  const metadata = props.item.metadata;
  let key = "key", suffix = "";
  while ((key + suffix) in metadata) {
    suffix = suffix == ""
        ? "0"
        : (parseInt(suffix) + 1).toString();
  }
  key = key + suffix;
  const blockId = props.item.id.slice(8); // 剪掉前面的 metadata
  s.setMetadataEntry(blockId, key, "", { type: "text" });
}

onMounted(() => {
  if (!$metadataItem.value) return;
  Object.assign($metadataItem.value, {
    expand: () => expand.value = true, // 将展开 metadata 的方法绑定到 $metadataItem 上
  });
});
</script>

<style lang="scss">
.metadata-item {
  position: relative;
  background: var(--bg-color);

  .metadata-header {
    display: flex;

    .header-title {
      margin-left: 4px;
      color: var(--text-secondary-color);
      transition: all 100ms ease-in-out;
      cursor: pointer;

      &:hover {
        color: var(--text-primary-color);
      }
    }

    .fold-button {
      height: 24px;
      width: 18px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;

      svg {
        height: 6px;
        width: 6px;
        fill: var(--bullet-color);
        transform: rotate(180deg);
        opacity: 0;
      }

      @at-root .metadata-header:hover .fold-button svg {
        opacity: 1;
      }

      @at-root .metadata-item:not(.expand) .fold-button svg {
        transform: rotate(90deg);
      }
    }

    .bullet {
      height: 24px;
      width: 18px;
      display: flex;
      justify-content: center;
      align-items: center;
      padding-right: 6px;
      cursor: pointer;
      background-color: var(--bg-color);

      svg {
        height: 5px;
        width: 5px;
        fill: var(--bullet-color);
        padding: 3px;
        border-radius: 9px;
        border: 1px dashed var(--text-secondary-color);
      }
    }
  }

  .metadata-entry {
    display: flex;
    margin-left: 50px;

    .type-icon {
      height: 24px;
      width: 18px;
      display: flex;
      justify-content: center;
      align-items: center;
      padding-right: 6px;
      cursor: pointer;
      //color: var(--text-secondary-color);
      background-color: var(--bg-color);

      svg {
        height: 14px;
        width: 14px;
      }
    }

    .metadata-key, .metadata-value {
      flex: 1;
      display: flex;
      position: relative;

      input {
        font-family: var(--normal-text-font);
        padding: 0;
        appearance: none;
        background-color: transparent;
        border: none;
        caret-color: var(--text-primary-color);
        color: var(--text-primary-color);
        box-sizing: border-box;
        font-size: var(--normal-text-font-size);
        text-indent: 3px;
        line-height: 24px;
      }

      input:focus {
        outline: none;
      }
    }

    .bullet {
      height: 24px;
      width: 18px;
      display: flex;
      justify-content: center;
      align-items: center;
      padding-right: 4px;
      cursor: pointer;
      background-color: var(--bg-color);

      svg {
        height: 5px;
        width: 5px;
        fill: var(--bullet-color);
        padding: 3px;
      }
    }
  }

  .add-new-property {
    font-size: .9em;
    color: var(--text-secondary-color);
    margin-left: 55px;
    cursor: pointer;
    transition: all 100ms ease-in-out;
    width: fit-content;

    &:hover {
      color: var(--text-primary-color);
    }
  }
}
</style>