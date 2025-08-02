// src/services/command-parser.ts
import { ParsedCommand, CommandPattern } from '../types';

export class CommandParser {
  private commandPatterns: CommandPattern[];

  constructor() {
    this.commandPatterns = this.initializePatterns();
  }

  private initializePatterns(): CommandPattern[] {
    return [
      // Agendar sessão
      {
        intent: 'schedule',
        patterns: [
          // "agendar Ana dia 10/08 as 14" - with "dia" prefix (most specific first)
          /(?:agendar|marcar)\s+([^\s]+(?:\s+[^\s]+)*?)\s+(?:no\s+)?dia\s+(\d{1,2}\/\d{1,2}(?:\/\d{4})?)\s+(?:às|as)\s+(\d{1,2})(?::(\d{2}))?(?:h)?(?:oras)?/i,
          // "agendar Ana na quinta feira as 14h" - with "na" and "feira"
          /(?:agendar|marcar)\s+([a-zaçeeioouu\s]+?)\s+na\s+(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)\s*feira\s+(?:às|as)\s+(\d{1,2})(?::(\d{2}))?(?:h)?(?:oras)?/i,
          // "agendar Ana amanhã as 9h" - specific "amanha as" pattern (normalized form)
          /(?:agendar|marcar)\s+([a-zaçeeioouu\s]+?)\s+(amanha)\s+(?:as)\s+(\d{1,2})(?::(\d{2}))?(?:h)?(?:oras)?/i,
          // "agendar Ana hoje as 15h" - specific "hoje as" pattern
          /(?:agendar|marcar)\s+([a-zaçeeioouu\s]+?)\s+(hoje)\s+(?:as)\s+(\d{1,2})(?::(\d{2}))?(?:h)?(?:oras)?/i,
          // "agendar Ana quinta 14h", "marcar João segunda 10:30"
          /(?:agendar|marcar)\s+([a-zaçeeioouu\s]+?)\s+(?:na\s+)?(?:próxima\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)(?:\s*feira)?\s+(?:às\s+)?(\d{1,2})(?::(\d{2}))?(?:h)?(?:oras)?/i,
          // "agendar Ana hoje 15h", "marcar João amanhã 9:30" - general pattern (normalized forms)
          /(?:agendar|marcar)\s+([a-zaçeeioouu\s]+?)\s+(hoje|amanha)\s+(?:as\s+)?(\d{1,2})(?::(\d{2}))?(?:h)?(?:oras)?/i,
          // "agendar Ana 23/01 14h", "marcar João 23/01/2024 10:30"  
          /(?:agendar|marcar)\s+([a-záãçéêíóôõú\s]+?)\s+(\d{1,2}\/\d{1,2}(?:\/\d{4})?)\s+(?:às\s+)?(\d{1,2})(?::(\d{2}))?(?:h)?(?:oras)?/i
        ],
        extract: (match, originalText) => {
          const datetime = this.parseDateTime(match[2], match[3], match[4]);
          return {
            action: 'schedule',
            patient: match[1] ? this.normalizeName(match[1]) : undefined,
            datetime,
            confidence: datetime ? 0.9 : 0.3,
            originalText
          };
        }
      },

      // Cancelar sessão
      {
        intent: 'cancel',
        patterns: [
          // "cancelar Ana dia 10/08 as 14h" - with date and time (most specific first)
          /(?:cancelar|desmarcar)\s+([^\s]+(?:\s+[^\s]+)*?)\s+(?:no\s+)?dia\s+(\d{1,2}\/\d{1,2}(?:\/\d{4})?)\s+(?:às|as)\s+(\d{1,2})(?::(\d{2}))?(?:h)?(?:oras)?/i,
          // "cancelar Ana dia 10/08" - with "dia" prefix (specific pattern)
          /(?:cancelar|desmarcar)\s+([^\s]+(?:\s+[^\s]+)*?)\s+(?:no\s+)?dia\s+(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/i,
          // "cancelar Ana quinta feira as 14h" - with time specification for more precision
          /(?:cancelar|desmarcar)\s+([a-zaçeeioouu\s]+?)\s+(?:na\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)(?:\s*feira)?\s+(?:às|as)\s+(\d{1,2})(?::(\d{2}))?(?:h)?(?:oras)?/i,
          // "cancelar Ana na quinta feira" - with "na" and "feira"
          /(?:cancelar|desmarcar)\s+([a-zaçeeioouu\s]+?)\s+na\s+(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)\s*feira/i,
          // "cancelar Ana quinta", "desmarcar João segunda"
          /(?:cancelar|desmarcar)\s+([a-zaçeeioouu\s]+?)\s+(?:na\s+)?(?:próxima\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)(?:\s*feira)?/i,
          // "cancelar Ana hoje", "desmarcar João amanhã"
          /(?:cancelar|desmarcar)\s+([a-záãçéêíóôõú\s]+?)\s+(hoje|amanhã)/i,
          // "cancelar Ana 23/01"
          /(?:cancelar|desmarcar)\s+([a-záãçéêíóôõú\s]+?)\s+(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/i
        ],
        extract: (match, originalText) => {
          // Handle different match group positions based on pattern
          let dateRef, timeRef, minutesRef;
          
          if (match[3] && /^\d{1,2}$/.test(match[3])) {
            // Pattern with time (groups: patient, date, hour, minutes)
            dateRef = match[2];
            timeRef = match[3];
            minutesRef = match[4];
          } else {
            // Pattern without time (groups: patient, date)
            dateRef = match[2];
          }
          
          const datetime = this.parseDateTime(dateRef, timeRef, minutesRef);
          return {
            action: 'cancel',
            patient: match[1] ? this.normalizeName(match[1]) : undefined,
            datetime,
            confidence: datetime ? 0.85 : 0.3,
            originalText
          };
        }
      },

      // Ver agenda
      {
        intent: 'view_agenda',
        patterns: [
          // "mostrar semana", "ver agenda", "minha agenda hoje"
          /(?:mostrar|ver|exibir)\s+(?:minha\s+)?(?:agenda|semana|dia)/i,
          // "agenda da semana", "agenda hoje", "agenda amanhã"
          /agenda\s+(?:da\s+)?(semana|hoje|amanhã)/i,
          // "como está minha semana", "o que tenho hoje"
          /(?:como\s+está\s+)?(?:minha\s+)?(?:semana|hoje|amanhã)/i
        ],
        extract: (match, originalText) => {
          const timeframe = this.extractTimeframe(originalText);
          return {
            action: 'view',
            timeframe,
            confidence: 0.95,
            originalText
          };
        }
      },

      // Bloquear horário
      {
        intent: 'block',
        patterns: [
          // "bloquear quinta tarde", "não atender sexta manhã"
          /(?:bloquear|não\s+atender)\s+(?:na\s+)?(segunda|terça|quarta|quinta|sexta|sábado|domingo|seg|ter|qua|qui|sex|sáb|dom)(?:\s*feira)?\s*(manhã|tarde|noite)?/i,
          // "bloquear hoje 14h às 16h"
          /bloquear\s+(hoje|amanhã|\d{1,2}\/\d{1,2})\s+(?:das\s+)?(\d{1,2})(?::(\d{2}))?(?:h)?\s*(?:às|até)\s*(\d{1,2})(?::(\d{2}))?(?:h)?/i
        ],
        extract: (match, originalText) => {
          const datetime = this.parseDateTime(match[1], match[2], match[3]);
          return {
            action: 'block',
            datetime,
            confidence: datetime ? 0.8 : 0.3,
            originalText
          };
        }
      },

      // Ajuda
      {
        intent: 'help',
        patterns: [
          /(?:ajuda|help|comandos|como\s+usar)/i,
          /o\s+que\s+(?:posso|você\s+pode)\s+fazer/i
        ],
        extract: (match, originalText) => ({
          action: 'help',
          confidence: 1.0,
          originalText
        })
      }
    ];
  }

  public parse(message: string): ParsedCommand {
    const normalizedMessage = this.normalizeMessage(message);

    for (const pattern of this.commandPatterns) {
      for (const regex of pattern.patterns) {
        const match = normalizedMessage.match(regex);
        if (match) {
          try {
            return pattern.extract(match, message);
          } catch (error) {
            console.error('Error parsing command:', error);
          }
        }
      }
    }

    // Se não encontrou padrão, retorna comando desconhecido
    return {
      action: 'unknown',
      confidence: 0,
      originalText: message
    };
  }

  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim();
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private parseDateTime(dateRef?: string, time?: string, minutes?: string): Date | undefined {
    if (!dateRef) return undefined;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    try {
      // Se é um dia da semana
      if (this.isWeekday(dateRef)) {
        const targetDate = this.getNextWeekday(dateRef);
        if (time) {
          const hour = parseInt(time, 10);
          const minute = minutes ? parseInt(minutes, 10) : 0;
          targetDate.setHours(hour, minute, 0, 0);
        }
        return targetDate;
      }

      // Se é hoje/amanhã (handles both original and normalized forms)
      if (dateRef === 'hoje') {
        if (time) {
          const hour = parseInt(time, 10);
          const minute = minutes ? parseInt(minutes, 10) : 0;
          today.setHours(hour, minute, 0, 0);
        }
        return today;
      }

      if (dateRef === 'amanhã' || dateRef === 'amanha') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (time) {
          const hour = parseInt(time, 10);
          const minute = minutes ? parseInt(minutes, 10) : 0;
          tomorrow.setHours(hour, minute, 0, 0);
        }
        return tomorrow;
      }

      // Se é uma data (DD/MM ou DD/MM/YYYY)
      if (dateRef.includes('/')) {
        const dateParts = dateRef.split('/');
        if (dateParts.length < 2 || !dateParts[0] || !dateParts[1]) {
          return undefined;
        }
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
        const year = dateParts[2] ? parseInt(dateParts[2], 10) : now.getFullYear();
        
        const targetDate = new Date(year, month, day);
        if (time) {
          const hour = parseInt(time, 10);
          const minute = minutes ? parseInt(minutes, 10) : 0;
          targetDate.setHours(hour, minute, 0, 0);
        }
        return targetDate;
      }

    } catch (error) {
      console.error('Error parsing date/time:', error);
    }

    return undefined;
  }

  private isWeekday(text: string): boolean {
    const weekdays = ['segunda', 'terça', 'terca', 'quarta', 'quinta', 'sexta', 'sábado', 'sabado', 'domingo', 
                     'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'sab', 'dom'];
    return weekdays.some(day => text.toLowerCase().includes(day));
  }

  private getNextWeekday(weekdayText: string): Date {
    const weekdayMap: { [key: string]: number } = {
      'segunda': 1, 'seg': 1,
      'terça': 2, 'ter': 2, 'terca': 2,
      'quarta': 3, 'qua': 3,
      'quinta': 4, 'qui': 4,
      'sexta': 5, 'sex': 5,
      'sábado': 6, 'sáb': 6, 'sabado': 6, 'sab': 6,
      'domingo': 0, 'dom': 0
    };

    const normalizedWeekday = weekdayText.toLowerCase().replace(/\s+/g, '');
    const targetDay = weekdayMap[normalizedWeekday];
    
    if (targetDay === undefined) {
      throw new Error(`Invalid weekday: ${weekdayText}`);
    }

    const today = new Date();
    const currentDay = today.getDay();
    
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7; // Next week
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    targetDate.setHours(0, 0, 0, 0);
    
    return targetDate;
  }

  private extractTimeframe(text: string): 'day' | 'week' | 'month' {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('semana')) return 'week';
    if (lowerText.includes('mês') || lowerText.includes('mes')) return 'month';
    if (lowerText.includes('hoje') || lowerText.includes('dia')) return 'day';
    
    return 'week'; // Default
  }
}