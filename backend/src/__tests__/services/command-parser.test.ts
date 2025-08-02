// src/__tests__/services/command-parser.test.ts
import { CommandParser } from '../../services/command-parser';

describe('CommandParser', () => {
  let parser: CommandParser;

  beforeEach(() => {
    parser = new CommandParser();
  });

  describe('Schedule Intent Tests', () => {
    describe('Basic Weekday Patterns', () => {
      it('should parse "agendar ana quinta 14h"', () => {
        const result = parser.parse('agendar ana quinta 14h');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Ana');
        expect(result.datetime).toBeInstanceOf(Date);
        expect(result.datetime?.getHours()).toBe(14);
        expect(result.confidence).toBe(0.9);
      });

      it('should parse "marcar joão segunda 10:30"', () => {
        const result = parser.parse('marcar joão segunda 10:30');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Joao'); // Accents removed in normalization
        expect(result.datetime?.getHours()).toBe(10);
        expect(result.datetime?.getMinutes()).toBe(30);
        expect(result.confidence).toBe(0.9);
      });
    });

    describe('Enhanced Patterns - "na...feira as"', () => {
      it('should parse "agendar ana na quinta feira as 14h"', () => {
        const result = parser.parse('agendar ana na quinta feira as 14h');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Ana');
        expect(result.datetime?.getHours()).toBe(14);
        expect(result.confidence).toBe(0.9);
      });

      it('should parse "marcar joão na segunda feira as 10:30"', () => {
        const result = parser.parse('marcar joão na segunda feira as 10:30');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Joao'); // Accents removed in normalization
        expect(result.datetime?.getHours()).toBe(10);
        expect(result.datetime?.getMinutes()).toBe(30);
        expect(result.confidence).toBe(0.9);
      });
    });

    describe('Date Patterns - "dia DD/MM"', () => {
      it('should parse "agendar ana dia 10/08 as 14"', () => {
        const result = parser.parse('agendar ana dia 10/08 as 14');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Ana');
        expect(result.datetime?.getDate()).toBe(10);
        expect(result.datetime?.getMonth()).toBe(7); // 0-indexed
        expect(result.datetime?.getHours()).toBe(14);
        expect(result.confidence).toBe(0.9);
      });

      it('should parse "marcar carlos no dia 23/12 as 16h"', () => {
        const result = parser.parse('marcar carlos no dia 23/12 as 16h');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Carlos');
        expect(result.datetime?.getDate()).toBe(23);
        expect(result.datetime?.getMonth()).toBe(11); // December = 11
        expect(result.datetime?.getHours()).toBe(16);
        expect(result.confidence).toBe(0.9);
      });
    });

    describe('Today/Tomorrow Patterns', () => {
      it('should parse "agendar ana hoje as 15h"', () => {
        const result = parser.parse('agendar ana hoje as 15h');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Ana');
        expect(result.datetime?.getHours()).toBe(15);
        expect(result.confidence).toBe(0.9);

        // Should be today's date
        const today = new Date();
        expect(result.datetime?.toDateString()).toBe(today.toDateString());
      });

      it('should parse "agendar pedro amanhã as 9h" (with accent)', () => {
        const result = parser.parse('agendar pedro amanhã as 9h');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Pedro');
        expect(result.datetime?.getHours()).toBe(9);
        expect(result.confidence).toBe(0.9);

        // Should be tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        expect(result.datetime?.toDateString()).toBe(tomorrow.toDateString());
      });

      it('should parse "agendar sofia amanha as 11h" (without accent)', () => {
        const result = parser.parse('agendar sofia amanha as 11h');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Sofia');
        expect(result.datetime?.getHours()).toBe(11);
        expect(result.confidence).toBe(0.9);

        // Should be tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        expect(result.datetime?.toDateString()).toBe(tomorrow.toDateString());
      });
    });

    describe('Complex Names', () => {
      it('should handle compound names', () => {
        const result = parser.parse('agendar maria da silva na sexta feira as 14h');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Maria Da Silva');
        expect(result.datetime?.getHours()).toBe(14);
        expect(result.confidence).toBe(0.9);
      });

      it('should handle names with "dos/das"', () => {
        const result = parser.parse('agendar josé dos santos dia 15/03 as 10h');
        
        expect(result.action).toBe('schedule');
        expect(result.patient).toBe('Jose Dos Santos'); // Accents removed in normalization
        expect(result.datetime?.getDate()).toBe(15);
        expect(result.datetime?.getMonth()).toBe(2); // March = 2
        expect(result.confidence).toBe(0.9);
      });
    });
  });

  describe('Cancel Intent Tests', () => {
    describe('Basic Cancel Patterns', () => {
      it('should parse "cancelar ana quinta"', () => {
        const result = parser.parse('cancelar ana quinta');
        
        expect(result.action).toBe('cancel');
        expect(result.patient).toBe('Ana');
        expect(result.datetime).toBeInstanceOf(Date);
        expect(result.confidence).toBe(0.85);
      });

      it('should parse "desmarcar joão segunda"', () => {
        const result = parser.parse('desmarcar joão segunda');
        
        expect(result.action).toBe('cancel');
        expect(result.patient).toBe('Joao'); // Accents removed in normalization
        expect(result.confidence).toBe(0.85);
      });
    });

    describe('Enhanced Cancel Patterns', () => {
      it('should parse "cancelar ana na quinta feira"', () => {
        const result = parser.parse('cancelar ana na quinta feira');
        
        expect(result.action).toBe('cancel');
        expect(result.patient).toBe('Ana');
        expect(result.confidence).toBe(0.85);
      });

      it('should parse "cancelar ana dia 10/08"', () => {
        const result = parser.parse('cancelar ana dia 10/08');
        
        expect(result.action).toBe('cancel');
        expect(result.patient).toBe('Ana');
        expect(result.datetime?.getDate()).toBe(10);
        expect(result.datetime?.getMonth()).toBe(7);
        expect(result.confidence).toBe(0.85);
      });

      it('should parse "cancelar ana quinta feira as 14h" with time', () => {
        const result = parser.parse('cancelar ana quinta feira as 14h');
        
        expect(result.action).toBe('cancel');
        expect(result.patient).toBe('Ana');
        expect(result.datetime?.getHours()).toBe(14);
        expect(result.confidence).toBe(0.85);
      });

      it('should parse "cancelar ana dia 10/08 as 14h" with date and time', () => {
        const result = parser.parse('cancelar ana dia 10/08 as 14h');
        
        expect(result.action).toBe('cancel');
        expect(result.patient).toBe('Ana');
        expect(result.datetime?.getDate()).toBe(10);
        expect(result.datetime?.getHours()).toBe(14);
        expect(result.confidence).toBe(0.85);
      });
    });
  });

  describe('View Agenda Intent Tests', () => {
    it('should parse "ver agenda"', () => {
      const result = parser.parse('ver agenda');
      
      expect(result.action).toBe('view');
      expect(result.timeframe).toBe('week');
      expect(result.confidence).toBe(0.95);
    });

    it('should parse "agenda da semana"', () => {
      const result = parser.parse('agenda da semana');
      
      expect(result.action).toBe('view');
      expect(result.timeframe).toBe('week');
      expect(result.confidence).toBe(0.95);
    });

    it('should parse "agenda hoje"', () => {
      const result = parser.parse('agenda hoje');
      
      expect(result.action).toBe('view');
      expect(result.timeframe).toBe('day');
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('Help Intent Tests', () => {
    it('should parse "ajuda"', () => {
      const result = parser.parse('ajuda');
      
      expect(result.action).toBe('help');
      expect(result.confidence).toBe(1.0);
    });

    it('should parse "o que posso fazer"', () => {
      const result = parser.parse('o que posso fazer');
      
      expect(result.action).toBe('help');
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('Block Intent Tests', () => {
    it('should parse "bloquear quinta tarde"', () => {
      const result = parser.parse('bloquear quinta tarde');
      
      expect(result.action).toBe('block');
      expect(result.datetime).toBeInstanceOf(Date);
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('Unknown Intent Tests', () => {
    it('should return unknown for unrecognized patterns', () => {
      const result = parser.parse('blablabla nonsense text');
      
      expect(result.action).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.originalText).toBe('blablabla nonsense text');
    });

    it('should return unknown for empty string', () => {
      const result = parser.parse('');
      
      expect(result.action).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle accented characters correctly', () => {
      const result = parser.parse('agendar joão amanhã às 14h');
      
      expect(result.action).toBe('schedule');
      expect(result.patient).toBe('Joao'); // Accents removed in normalization
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle case insensitive input', () => {
      const result = parser.parse('AGENDAR ANA QUINTA 14H');
      
      expect(result.action).toBe('schedule');
      expect(result.patient).toBe('Ana');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle extra whitespace', () => {
      const result = parser.parse('  agendar   ana   quinta   14h  ');
      
      expect(result.action).toBe('schedule');
      expect(result.patient).toBe('Ana');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle malformed dates gracefully', () => {
      const result = parser.parse('agendar ana 32/15 14h');
      
      expect(result.action).toBe('schedule');
      expect(result.patient).toBe('Ana');
      // Malformed date still gives high confidence for the pattern match
      expect(result.confidence).toBe(0.9);
    });

    it('should handle missing patient name', () => {
      const result = parser.parse('agendar quinta 14h');
      
      expect(result.action).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should handle time without minutes', () => {
      const result = parser.parse('agendar ana quinta 14');
      
      expect(result.action).toBe('schedule');
      expect(result.patient).toBe('Ana');
      expect(result.datetime?.getHours()).toBe(14);
      expect(result.datetime?.getMinutes()).toBe(0);
    });
  });

  describe('Name Normalization', () => {
    it('should normalize names with proper capitalization', () => {
      const result = parser.parse('agendar MARIA DA SILVA quinta 14h');
      
      expect(result.patient).toBe('Maria Da Silva');
    });

    it('should handle names with multiple spaces', () => {
      const result = parser.parse('agendar   josé    dos   santos   quinta 14h');
      
      expect(result.patient).toBe('Jose Dos Santos'); // Accents removed in normalization
    });

    it('should preserve Portuguese names correctly', () => {
      const result = parser.parse('agendar joão césar de oliveira quinta 14h');
      
      expect(result.patient).toBe('Joao Cesar De Oliveira'); // Accents removed in normalization
    });
  });

  describe('Date Range Tests', () => {
    it('should handle dates with full year', () => {
      const result = parser.parse('agendar ana 25/12/2024 9:30');
      
      expect(result.action).toBe('schedule');
      expect(result.datetime?.getFullYear()).toBe(2024);
      expect(result.datetime?.getMonth()).toBe(11); // December
      expect(result.datetime?.getDate()).toBe(25);
      expect(result.datetime?.getHours()).toBe(9);
      expect(result.datetime?.getMinutes()).toBe(30);
    });

    it('should default to current year when year not specified', () => {
      const currentYear = new Date().getFullYear();
      const result = parser.parse('agendar ana 25/12 9:30');
      
      expect(result.datetime?.getFullYear()).toBe(currentYear);
    });
  });

  describe('Weekday Variations', () => {
          const weekdayTests = [
        { input: 'segunda', day: 1 },
        { input: 'seg', day: 1 },
        { input: 'terca', day: 2 }, // Without accent
        { input: 'ter', day: 2 },
        { input: 'quarta', day: 3 },
        { input: 'qua', day: 3 },
        { input: 'quinta', day: 4 },
        { input: 'qui', day: 4 },
        { input: 'sexta', day: 5 },
        { input: 'sex', day: 5 },
        { input: 'sabado', day: 6 }, // Without accent
        { input: 'sab', day: 6 }, // Without accent
        { input: 'domingo', day: 0 },
        { input: 'dom', day: 0 }
      ];

    weekdayTests.forEach(({ input, day }) => {
      it(`should parse weekday "${input}" correctly`, () => {
        const result = parser.parse(`agendar ana ${input} 14h`);
        
        expect(result.action).toBe('schedule');
        expect(result.datetime?.getDay()).toBe(day);
      });
    });
  });
});