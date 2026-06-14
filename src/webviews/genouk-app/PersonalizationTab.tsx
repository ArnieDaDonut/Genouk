import React, { useState } from 'react';
import { Volume2, Check } from 'lucide-react';
import { t } from './theme';
import { Card, Label } from './ui';
import { Personalization } from './types';
import { ACCESSORIES, Accessory, accessoryImageUrl } from './accessories';
import { SFX_MENU, SfxName } from './musicEngine';

interface Props {
  personalization: Personalization;
  onChange: (p: Personalization) => void;
  onPreviewSfx: (name: string) => void;
}

const selectStyle: React.CSSProperties = {
  flex: 1,
  boxSizing: 'border-box',
  background: t.color.inputBg,
  color: t.color.inputFg,
  border: `1px solid ${t.color.inputBorder}`,
  borderRadius: t.radius.sm,
  padding: '6px 8px',
  fontSize: t.font.size.md,
  fontFamily: t.font.ui,
  outline: 'none',
};

function SoundRow({
  label, value, options, onPick, onPreview,
}: {
  label: string;
  value: string;
  options: { name: SfxName; label: string }[];
  onPick: (name: string) => void;
  onPreview: (name: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Label>{label}</Label>
      <div style={{ display: 'flex', gap: t.space.sm, alignItems: 'center' }}>
        <select value={value} onChange={(e) => { onPick(e.target.value); onPreview(e.target.value); }} style={selectStyle}>
          {options.map((o) => <option key={o.name} value={o.name}>{o.label}</option>)}
        </select>
        <button
          onClick={() => onPreview(value)}
          title="Preview"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: t.color.surfaceHover, color: t.color.fg,
            border: `1px solid ${t.color.border}`, borderRadius: t.radius.sm,
            padding: '6px 10px', cursor: 'pointer', fontSize: t.font.size.sm,
          }}
        >
          <Volume2 size={13} /> Play
        </button>
      </div>
    </div>
  );
}

/** Thumbnail for an accessory: its cut-out PNG, falling back to the emoji. */
function AccessoryThumb({ accessory }: { accessory: Accessory }) {
  const [broken, setBroken] = useState(false);
  const url = accessoryImageUrl(accessory);
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        style={{ width: 26, height: 26, objectFit: 'contain' }}
      />
    );
  }
  return <span style={{ fontSize: 22, lineHeight: 1 }}>{accessory.emoji || '🚫'}</span>;
}

export const PersonalizationTab: React.FC<Props> = ({ personalization, onChange, onPreviewSfx }) => {
  const setAccessory = (id: string) => onChange({ ...personalization, accessory: id });
  const setSfx = (slot: keyof Personalization['sfx'], name: string) =>
    onChange({ ...personalization, sfx: { ...personalization.sfx, [slot]: name } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
      {/* Accessories */}
      <Card>
        <Label>Accessories</Label>
        <p style={{ margin: '4px 0 10px', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.4 }}>
          Give Genouk a look. Your pick rides along on the character.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: t.space.sm }}>
          {ACCESSORIES.map((a) => {
            const active = personalization.accessory === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setAccessory(a.id)}
                title={a.label}
                style={{
                  position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  background: active ? t.color.surfaceHover : 'transparent',
                  border: `1px solid ${active ? t.color.accent : t.color.border}`,
                  borderRadius: t.radius.sm, padding: '8px 4px', cursor: 'pointer',
                  color: t.color.fg, minHeight: 58,
                }}
              >
                <AccessoryThumb accessory={a} />
                <span style={{ fontSize: t.font.size.xs, color: active ? t.color.fg : t.color.muted, textAlign: 'center' }}>{a.label}</span>
                {active && (
                  <Check size={11} style={{ position: 'absolute', top: 3, right: 3, color: t.color.accent }} />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Sound effects */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
        <div>
          <Label>Sound effects</Label>
          <p style={{ margin: '4px 0 0', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.4 }}>
            Pick the sound for each event. These are synthesized live — preview before you commit.
          </p>
        </div>
        <SoundRow
          label="Good compile"
          value={personalization.sfx.goodCompile}
          options={SFX_MENU.good}
          onPick={(n) => setSfx('goodCompile', n)}
          onPreview={onPreviewSfx}
        />
        <SoundRow
          label="Bad compile"
          value={personalization.sfx.badCompile}
          options={SFX_MENU.bad}
          onPick={(n) => setSfx('badCompile', n)}
          onPreview={onPreviewSfx}
        />
        <SoundRow
          label="Agent needs attention"
          value={personalization.sfx.notification}
          options={SFX_MENU.notification}
          onPick={(n) => setSfx('notification', n)}
          onPreview={onPreviewSfx}
        />
      </Card>
    </div>
  );
};
