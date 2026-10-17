import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { C, mono } from './theme';

export function Btn({
  label, onPress, kind = 'solid', small, style,
}: {
  label: string; onPress: () => void; kind?: 'solid' | 'ghost' | 'amber'; small?: boolean; style?: ViewStyle;
}) {
  const bg = kind === 'solid' ? C.indigo : kind === 'amber' ? C.amber : 'transparent';
  const fg = kind === 'ghost' ? C.indigo : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderColor: kind === 'ghost' ? C.indigo : bg, paddingVertical: small ? 8 : 14, opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[s.chip, on && { backgroundColor: C.indigo, borderColor: C.indigo }]}
    >
      <Text style={{ color: on ? '#fff' : C.ink2, fontSize: 13, fontWeight: on ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Chips({ children }: { children: React.ReactNode }) {
  return <View style={s.chips}>{children}</View>;
}

export function Lbl({ children }: { children: React.ReactNode }) {
  return <Text style={s.lbl}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function Card({ children, flat }: { children: React.ReactNode; flat?: boolean }) {
  return <View style={[s.card, flat && { backgroundColor: C.surface2 }]}>{children}</View>;
}

export function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={s.head}>
      <Text style={s.h2}>{title}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Meter({ pct, color = C.indigo }: { pct: number; color?: string }) {
  return (
    <View style={s.meter}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

export function Faces({
  opts, value, onPick,
}: { opts: [string, string][]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {opts.map(([e, n]) => {
        const on = value === n;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(on ? '' : n)}
            style={[s.face, on && { borderColor: C.indigo, backgroundColor: C.indigoSoft }]}
          >
            <Text style={{ fontSize: 24 }}>{e}</Text>
            <Text style={{ fontSize: 10.5, color: C.ink2 }}>{n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={C.ink3} {...props} style={[s.input, props.multiline && { minHeight: 76, textAlignVertical: 'top' }, props.style]} />;
}

export function Steps({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Btn small kind="ghost" label="−" onPress={() => onChange(Math.max(min, value - step))} style={{ width: 52 }} />
      <Btn small kind="ghost" label="＋" onPress={() => onChange(Math.min(max, value + step))} style={{ width: 52 }} />
    </View>
  );
}

export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>{children}</View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  btn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  lbl: { fontFamily: mono, fontSize: 11.5, letterSpacing: 0.8, color: C.ink3, fontWeight: '700' },
  muted: { fontSize: 12.5, color: C.ink3, lineHeight: 19 },
  card: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  h2: { fontSize: 20, fontWeight: '800', color: C.ink, flexShrink: 1 },
  sub: { fontSize: 12, color: C.ink3, fontFamily: mono },
  meter: { height: 9, borderRadius: 5, backgroundColor: C.surface3, overflow: 'hidden' },
  face: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  input: { borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: C.ink },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: C.surface, padding: 18, gap: 12, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '85%' },
});
