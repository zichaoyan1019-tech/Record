
import React from 'react';
import { getMoodColor, hexToRgba } from '../utils';

interface MoodBackgroundProps {
  moodKey: string;
  moodScore: number;
}

const MoodBackground: React.FC<MoodBackgroundProps> = ({ moodKey, moodScore }) => {
  // 1. Base Colors
  const baseBgColor = getMoodColor(moodKey, moodScore, 'light');
  const accentColor = getMoodColor(moodKey, moodScore, 'medium');
  const strongColor = getMoodColor(moodKey, moodScore, 'strong');
  
  // Layer 1: Atmosphere (Gradient)
  const bgGradient = `radial-gradient(circle at 85% 10%, ${hexToRgba(accentColor, 0.4)} 0%, transparent 70%)`;

  // Layer 2: Texture (Character)
  const getTextureStyle = () => {
    const textureColor = hexToRgba(strongColor, 0.12); 

    switch (moodKey) {
      case 'happy':
      case 'satisfied':
        return {
          backgroundImage: `
            radial-gradient(circle at 50% 50%, transparent 45%, ${textureColor} 46%, transparent 47%),
            radial-gradient(circle at 80% 20%, transparent 20%, ${textureColor} 21%, transparent 22%)
          `,
          backgroundSize: '100px 100px', 
        };
      case 'calm':
      case 'peaceful':
        return {
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, ${textureColor} 40px)`,
          backgroundSize: '100% 40px'
        };
      case 'sad':
      case 'depressed':
      case 'tired':
        return {
          backgroundImage: `repeating-linear-gradient(180deg, transparent, transparent 29px, ${textureColor} 30px)`,
          backgroundSize: '100% 30px'
        };
      case 'anxious':
      case 'nervous':
      case 'stress':
        return {
           backgroundImage: `
             repeating-linear-gradient(45deg, transparent, transparent 10px, ${textureColor} 11px),
             repeating-linear-gradient(-45deg, transparent, transparent 10px, ${textureColor} 11px)
           `,
           backgroundSize: '20px 20px'
        };
      case 'angry':
        return {
            backgroundImage: `linear-gradient(135deg, ${textureColor} 0%, transparent 30%)`,
            backgroundSize: '100% 100%'
        };
      default:
        // Neutral - Warm grid
        return {
          backgroundImage: `
            linear-gradient(${textureColor} 1px, transparent 1px),
            linear-gradient(90deg, ${textureColor} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        };
    }
  };

  // Decoration Colors
  const ringColor = hexToRgba(strongColor, 0.25);
  const solidShapeColor = hexToRgba(accentColor, 0.35);
  const dotColor = hexToRgba(strongColor, 0.4);

  return (
    <div 
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 transition-colors duration-1000 ease-in-out" 
      style={{ backgroundColor: baseBgColor }}
    > 
      
      {/* Layer 1: Atmosphere Gradient */}
      <div 
        className="absolute inset-0 transition-all duration-1000 animate-pulse-slow"
        style={{ background: bgGradient }}
      />

      {/* Layer 2: Pattern Texture */}
      <div 
        className="absolute inset-0 transition-all duration-1000 mix-blend-multiply opacity-80"
        style={getTextureStyle()}
      />

      {/* --- NEW LAYER: ABSTRACT DECORATIVE ELEMENTS (ANIMATED) --- */}
      
      {/* Top Right: The "Halo" (Large Ring) - Organic rotation */}
      {/* Using border-radius manipulation to make it "blobby" so rotation is visible */}
      <div 
        className="absolute -top-[5%] -right-[15%] w-[350px] h-[350px] border-[40px] transition-all duration-1000 animate-spin-organic"
        style={{ 
          borderColor: ringColor,
          borderRadius: '42% 58% 70% 30% / 45% 45% 55% 55%' // Irregular shape
        }}
      />
      
      {/* Top Right: Inner Accent Ring - Counter floating */}
      <div 
        className="absolute top-[8%] -right-[5%] w-[180px] h-[180px] rounded-full border-[3px] transition-all duration-1000 animate-float-delayed"
        style={{ borderColor: ringColor }}
      />

      {/* Middle Left: The "Focus" (Solid Soft Circle) - Breathing and drifting */}
      <div 
        className="absolute top-[18%] -left-[5%] w-[160px] h-[160px] rounded-full filter blur-xl transition-all duration-1000 animate-blob mix-blend-multiply"
        style={{ backgroundColor: solidShapeColor }}
      />
      
      {/* Middle Left: Decorative Tiny Dots - Floating separately */}
      <div className="absolute top-[32%] left-[12%] flex space-x-3 opacity-80 animate-float">
         <div className="w-3 h-3 rounded-full transition-colors duration-1000" style={{ backgroundColor: dotColor }}></div>
         <div className="w-3 h-3 rounded-full transition-colors duration-1000 mt-2" style={{ backgroundColor: dotColor }}></div>
         <div className="w-3 h-3 rounded-full transition-colors duration-1000" style={{ backgroundColor: dotColor }}></div>
      </div>

      {/* Bottom Area: Organic Shapes - Slow Drift */}
      <div 
        className="absolute bottom-[18%] right-[8%] w-[120px] h-[120px] rounded-full border-[10px] transition-all duration-1000 opacity-60 animate-drift"
        style={{ borderColor: ringColor }}
      />
      
      {/* Bottom Large Background Blur - Slow Float */}
      <div 
        className="absolute bottom-[-8%] left-[15%] w-[320px] h-[320px] rounded-full filter blur-[50px] opacity-50 transition-all duration-1000 animate-float-slow"
        style={{ backgroundColor: solidShapeColor }}
      />

    </div>
  );
};

export default MoodBackground;
