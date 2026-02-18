
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";
import { cleanBase64 } from "../utils";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createBlankImage = (width: number, height: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
  return cleanBase64(canvas.toDataURL('image/png'));
};

export const generateStyleSuggestion = async (text: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Gere uma descrição visual cinematográfica de 10 palavras para uma animação de texto de: "${text}". Foque em iluminação, materiais e ambiente.`
    });
    return response.text?.trim() || "";
  } catch (e) { return "Cenário cinematográfico minimalista com iluminação dramática."; }
};

export const generateAdCaption = async (description: string, style: string, link: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Crie uma propaganda viral curta e impactante em PORTUGUÊS para o produto: "${description}". 
      O estilo visual é: "${style}".
      REGRA CRÍTICA: O texto deve ter NO MÁXIMO 150 caracteres para caber emojis. 
      Não inclua o link no texto, ele será adicionado depois. 
      Use gatilhos mentais de urgência ou qualidade. 
      Apenas o texto da propaganda.`
    });
    
    const textoIA = response.text?.trim().slice(0, 160);
    if (!textoIA || textoIA.length < 5) throw new Error("Falha na IA");
    return textoIA;
  } catch (e) {
    // PLANO B: MOTOR INTERNO (Caso a API falhe ou demore)
    const frases = [
      `🔥 OFERTA! Confira agora esse incrível ${description}. Qualidade garantida e preço especial hoje! 🚀`,
      `⚡ ACHADINHO: Acabamos de encontrar o melhor ${description} para você. Aproveite antes que acabe! 😍`,
      `🚨 PROMOÇÃO! ${description} com o visual que você sempre quis. Design e performance únicos! ✅`,
      `✨ NOVIDADE! O ${description} que é tendência absoluta chegou. Garanta o seu com exclusividade! 💎`
    ];
    return frases[Math.floor(Math.random() * frases.length)];
  }
};

interface TextImageOptions {
  text: string;
  style: string;
  typographyPrompt?: string;
  referenceImage?: string;
}

export const generateTextImage = async ({ text, style, typographyPrompt, referenceImage }: TextImageOptions): Promise<{ data: string, mimeType: string }> => {
  const ai = getAI();
  const parts: any[] = [];
  const typo = typographyPrompt || "High-quality luxury typography.";

  if (referenceImage) {
    const [mimeTypePart, data] = referenceImage.split(';base64,');
    parts.push({ inlineData: { data: data, mimeType: mimeTypePart.replace('data:', '') } });
    parts.push({ text: `Create a cinematic image with the text "${text}" written in it. Match the environment and palette of the provided image. Typography: ${typo}. Visual style: ${style}.` });
  } else {
    parts.push({ text: `A hyper-realistic cinematic 8k image featuring the text "${text}". Typography: ${typo}. Environment style: ${style}. Dramatic lighting, professional design.` });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } }
  });

  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData) return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
  throw new Error("Falha ao gerar imagem.");
};

export const generateTextVideo = async (text: string, imageBase64: string, imageMimeType: string, promptStyle: string, caption: string): Promise<string> => {
  const ai = getAI();
  const startImage = createBlankImage(1280, 720);
  
  // Prompt refinado para criar uma propaganda visual "confortável e estética"
  // Integramos a propaganda gerada (caption) como legendas minimalistas dentro do próprio vídeo.
  const veoPrompt = `A high-end cinematic product commercial for "${text}". 
  The video features elegant, non-aggressive advertising legends displaying the text: "${caption}". 
  The typography materializes softly within the scene, integrated into the ${promptStyle} environment. 
  The legends are comfortable, minimalist, and aesthetically pleasing, not distracting from the product. 
  Extreme focus on the craftsmanship and details of the product. 
  Smooth, professional camera motion. ${promptStyle}. High definition.`;

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: veoPrompt,
    image: { imageBytes: startImage, mimeType: 'image/png' },
    config: { 
      numberOfVideos: 1, 
      resolution: '720p', 
      aspectRatio: '16:9',
      lastFrame: { imageBytes: cleanBase64(imageBase64), mimeType: imageMimeType }
    }
  });

  while (!operation.done) {
    await sleep(5000);
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!uri) throw new Error("Falha ao gerar vídeo.");
  const res = await fetch(`${uri}&key=${process.env.API_KEY}`);
  return URL.createObjectURL(await res.blob());
};
