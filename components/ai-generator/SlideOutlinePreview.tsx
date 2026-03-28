'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

export type Slide = {
  number: number
  title: string
  bullets: string[]
  imageNote: string
  speakerNotes: string
}

export type SlideDeck = {
  title: string
  slides: Slide[]
}

type Props = {
  content: string   // raw JSON string
  deckTitle: string
}

export default function SlideOutlinePreview({ content, deckTitle }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [exporting, setExporting] = useState(false)

  let deck: SlideDeck | null = null
  try {
    deck = JSON.parse(content) as SlideDeck
  } catch {
    return (
      <div className="p-4 text-[13px] text-red-600">
        Could not parse slide outline. The raw content is shown below.
        <pre className="mt-2 text-[11px] text-gray-500 whitespace-pre-wrap break-all">{content}</pre>
      </div>
    )
  }

  const slides = deck.slides ?? []

  function toggleExpand(n: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  async function handleExport() {
    setExporting(true)
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = [
        new Paragraph({
          text: deck!.title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      ]

      for (const slide of slides) {
        // Slide heading
        children.push(
          new Paragraph({
            text: `Slide ${slide.number}: ${slide.title}`,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 100 },
          }),
        )

        // Bullets
        for (const bullet of slide.bullets) {
          children.push(
            new Paragraph({
              text: bullet,
              bullet: { level: 0 },
              spacing: { after: 60 },
            }),
          )
        }

        // Image note
        if (slide.imageNote) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Image note: ', bold: true, italics: true, size: 20 }),
                new TextRun({ text: slide.imageNote, italics: true, size: 20 }),
              ],
              spacing: { before: 100, after: 60 },
            }),
          )
        }

        // Speaker notes
        if (slide.speakerNotes) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Speaker notes: ', bold: true, size: 20 }),
                new TextRun({ text: slide.speakerNotes, size: 20 }),
              ],
              spacing: { before: 60, after: 200 },
            }),
          )
        }
      }

      const doc = new Document({ sections: [{ children }] })
      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${deck!.title.replace(/[^a-z0-9\s-]/gi, '').trim()}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Export button */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <p className="text-[12px] text-gray-500">{slides.length} slides</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold transition-colors disabled:opacity-50"
        >
          <Icon name="download" size="sm" />
          {exporting ? 'Exporting…' : 'Export .docx'}
        </button>
      </div>

      {/* Slides */}
      <div className="flex-1 overflow-auto space-y-2.5">
        {slides.map(slide => {
          const open = expanded.has(slide.number)
          return (
            <div key={slide.number} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Slide header — always visible */}
              <button
                onClick={() => toggleExpand(slide.number)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {slide.number}
                </span>
                <span className="flex-1 text-[13px] font-semibold text-gray-800 truncate">
                  {slide.title}
                </span>
                {open ? <Icon name="expand_less" size="sm" className="text-gray-400 flex-shrink-0" /> : <Icon name="expand_more" size="sm" className="text-gray-400 flex-shrink-0" />}
              </button>

              {/* Expanded body */}
              {open && (
                <div className="px-4 py-3 bg-white space-y-3">
                  {/* Bullets */}
                  <ul className="space-y-1">
                    {slide.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-gray-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* Image note */}
                  {slide.imageNote && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <Icon name="image" size="sm" className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-800 italic">{slide.imageNote}</p>
                    </div>
                  )}

                  {/* Speaker notes */}
                  {slide.speakerNotes && (
                    <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                      <Icon name="chat" size="sm" className="text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-blue-800">{slide.speakerNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
