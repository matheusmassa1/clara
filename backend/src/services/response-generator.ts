// src/services/response-generator.ts
import { ParsedCommand, ConflictInfo, AvailableSlot } from '../types';

export class ResponseGenerator {
  
  generateWelcomeMessage(psychologistName?: string): string {
    if (psychologistName) {
      return `👋 Olá, Dr(a). ${psychologistName}!\n\nSou a Clara, sua assistente de agendamento. Como posso ajudar hoje?\n\n💡 Você pode:\n• "Agendar Ana quinta 14h"\n• "Cancelar João amanhã"\n• "Mostrar minha semana"\n• "Ajuda" para mais comandos`;
    }

    return `👋 Olá! Sou a Clara, sua assistente de agendamento.\n\nPreciso configurar seu perfil primeiro:\n• Qual seu nome completo?\n• Quais seus horários de trabalho? (ex: "Seg-Sex 9h-18h")\n\nDigite suas informações para começarmos!`;
  }

  generateScheduleConfirmation(
    patientName: string,
    datetime: Date,
    duration: number = 50
  ): string {
    const dateStr = this.formatDate(datetime);
    const timeStr = this.formatTime(datetime);
    const endTime = new Date(datetime.getTime() + duration * 60000);
    const endTimeStr = this.formatTime(endTime);

    return `📅 Agendando ${patientName}:\n\n• Data: ${dateStr}\n• Horário: ${timeStr} - ${endTimeStr}\n• Duração: ${duration} minutos\n\nConfirmar agendamento? (Sim/Não)`;
  }

  generateScheduleSuccess(
    patientName: string,
    datetime: Date,
    calendarLink?: string
  ): string {
    const dateStr = this.formatDate(datetime);
    const timeStr = this.formatTime(datetime);

    let message = `✅ Sessão agendada com sucesso!\n\n👤 Paciente: ${patientName}\n📅 Data: ${dateStr}\n⏰ Horário: ${timeStr}\n\n📲 Adicionado ao Google Calendar`;
    
    if (calendarLink) {
      message += `\n🔗 Link: ${calendarLink}`;
    }

    return message;
  }

  generateNewPatientConfirmation(patientName: string): string {
    return `👤 Não encontrei ${patientName} nos seus pacientes.\n\nDeseja adicionar como novo paciente? (Sim/Não)`;
  }

  generateConflictMessage(conflict: ConflictInfo, patientName: string, datetime: Date): string {
    let message = `⚠️ Conflito detectado!\n\n`;

    if (conflict.conflictingSession) {
      message += `Você já tem ${conflict.conflictingSession.patientName} agendado das ${conflict.conflictingSession.startTime} às ${conflict.conflictingSession.endTime}`;
    } else {
      message += `Horário indisponível para agendamento`;
    }

    if (conflict.availableSlots && conflict.availableSlots.length > 0) {
      const dayName = this.formatDate(datetime);
      message += `\n\n📅 Horários disponíveis em ${dayName}:\n`;
      
      conflict.availableSlots.slice(0, 4).forEach(slot => {
        message += `• ${slot.formatted} ✅\n`;
      });

      if (conflict.availableSlots.length > 4) {
        message += `\n... e mais ${conflict.availableSlots.length - 4} horários`;
      }

      if (conflict.availableSlots[0]) {
        message += `\n💡 Tente: "Agendar ${patientName} ${this.getWeekdayName(datetime)} ${this.formatTime(conflict.availableSlots[0].start)}"`;
      }
    }

    return message;
  }

  generateCancelConfirmation(
    patientName: string,
    datetime: Date,
    sessionTime?: string
  ): string {
    const dateStr = this.formatDate(datetime);
    
    return `❌ Cancelar sessão?\n\n👤 Paciente: ${patientName}\n📅 Data: ${dateStr}${sessionTime ? `\n⏰ Horário: ${sessionTime}` : ''}\n\nConfirmar cancelamento? (Sim/Não)`;
  }

  generateCancelSuccess(patientName: string, datetime: Date): string {
    const dateStr = this.formatDate(datetime);
    
    return `✅ Sessão cancelada!\n\n👤 ${patientName}\n📅 ${dateStr}\n\n🗓️ Removido do Google Calendar\nHorário liberado para novos agendamentos`;
  }

  generateAgendaView(sessions: any[], timeframe: 'day' | 'week' | 'month' = 'week'): string {
    if (sessions.length === 0) {
      const periodName = this.getPeriodName(timeframe);
      return `📅 Sua agenda ${periodName}\n\n🆓 Nenhuma sessão agendada\n\nQue tal aproveitar para agendar novos pacientes?`;
    }

    const periodName = this.getPeriodName(timeframe);
    let message = `📅 Sua agenda ${periodName}\n\n`;

    if (timeframe === 'day') {
      sessions.forEach(session => {
        const timeStr = this.formatTime(session.scheduledAt);
        message += `• ${timeStr} - ${session.patient.fullName}\n`;
      });
    } else {
      // Group by date
      const sessionsByDate = this.groupSessionsByDate(sessions);
      
      Object.entries(sessionsByDate).forEach(([date, dateSessions]) => {
        message += `**${date}**\n`;
        dateSessions.forEach(session => {
          const timeStr = this.formatTime(session.scheduledAt);
          message += `• ${timeStr} - ${session.patient.fullName}\n`;
        });
        message += '\n';
      });
    }

    message += `\nTotal: ${sessions.length} sessão${sessions.length !== 1 ? 'ões' : ''} ${this.getPeriodName(timeframe, true)}`;
    
    return message;
  }

  generateErrorMessage(error: string): string {
    return `❌ Ops! ${error}\n\n💡 Precisa de ajuda? Digite "ajuda" para ver os comandos disponíveis.`;
  }

  generateUnknownCommandMessage(): string {
    return `🤔 Não entendi sua mensagem.\n\n💡 Você pode tentar:\n• "Agendar [nome] [dia] [hora]"\n• "Cancelar [nome] [dia]"\n• "Mostrar agenda"\n• "Ajuda" para mais opções`;
  }

  generateHelpMessage(): string {
    return `🆘 **Comandos Disponíveis**\n\n**📅 Agendamento:**\n• "Agendar Ana quinta 14h"\n• "Marcar João segunda 10:30"\n• "Agendar Maria 25/01 15h"\n\n**❌ Cancelamento:**\n• "Cancelar Ana quinta"\n• "Desmarcar João amanhã"\n\n**📋 Visualizar:**\n• "Mostrar semana"\n• "Ver agenda hoje"\n• "Minha agenda"\n\n**🚫 Bloquear:**\n• "Bloquear sexta tarde"\n• "Não atender quinta 14h às 16h"\n\n💬 Fale naturalmente comigo!`;
  }

  generateValidationErrors(errors: string[]): string {
    if (errors.length === 1) {
      return `❌ ${errors[0]}`;
    }

    let message = `❌ Encontrei alguns problemas:\n\n`;
    errors.forEach((error, index) => {
      message += `${index + 1}. ${error}\n`;
    });

    return message;
  }

  generateConfirmationPrompt(): string {
    return `\n\n💬 Responda com "Sim" ou "Não"`;
  }

  generatePatientNotFoundSuggestions(inputName: string, suggestions: any[]): string {
    let message = `👤 Paciente "${inputName}" não encontrado.\n\n`;

    if (suggestions.length > 0) {
      message += `Você quis dizer:\n`;
      suggestions.slice(0, 3).forEach((patient, index) => {
        message += `${index + 1}. ${patient.fullName}\n`;
      });
      message += `\nOu deseja criar novo paciente? (Sim/Não)`;
    } else {
      message += `Deseja adicionar "${inputName}" como novo paciente? (Sim/Não)`;
    }

    return message;
  }

  generateWorkingHoursMessage(workingHours: any): string {
    let message = `⏰ **Seus horários de trabalho:**\n\n`;

    const dayNames: { [key: string]: string } = {
      seg: 'Segunda',
      ter: 'Terça',
      qua: 'Quarta',
      qui: 'Quinta',
      sex: 'Sexta',
      sab: 'Sábado',
      dom: 'Domingo'
    };

    Object.entries(workingHours).forEach(([day, hours]) => {
      const dayName = dayNames[day] || day;
      if (hours === 'closed' || !hours) {
        message += `📅 ${dayName}: Fechado\n`;
      } else {
        message += `📅 ${dayName}: ${hours}\n`;
      }
    });

    return message;
  }

  private formatDate(date: Date): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (this.isSameDay(date, today)) {
      return 'Hoje';
    } else if (this.isSameDay(date, tomorrow)) {
      return 'Amanhã';
    } else {
      return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit'
      });
    }
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private getWeekdayName(date: Date): string {
    const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const day = date.getDay();
    return (day >= 0 && day < weekdays.length) ? weekdays[day]! : 'domingo';
  }

  private getPeriodName(timeframe: 'day' | 'week' | 'month', preposition: boolean = false): string {
    const periods = {
      day: preposition ? 'hoje' : 'de hoje',
      week: preposition ? 'nesta semana' : 'da semana',
      month: preposition ? 'neste mês' : 'do mês'
    };
    
    return periods[timeframe] || 'do período';
  }

  private groupSessionsByDate(sessions: any[]): { [date: string]: any[] } {
    const grouped: { [date: string]: any[] } = {};

    sessions.forEach(session => {
      const dateKey = this.formatDate(session.scheduledAt);
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(session);
    });

    // Sort sessions within each date
    Object.keys(grouped).forEach(date => {
      grouped[date]?.sort((a, b) => 
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
    });

    return grouped;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }
}