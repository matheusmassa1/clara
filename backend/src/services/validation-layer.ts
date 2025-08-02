// src/services/validation-layer.ts
import { PrismaClient } from '@prisma/client';
import { ConflictInfo, AvailableSlot, ParsedCommand } from '../types';

export class ValidationLayer {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async validateScheduleCommand(
    command: ParsedCommand,
    psychologistId: string
  ): Promise<{
    isValid: boolean;
    conflicts: ConflictInfo;
    patient?: any;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Validar dados básicos
    if (!command.patient) {
      errors.push('Nome do paciente é obrigatório');
    }

    if (!command.datetime) {
      errors.push('Data e horário são obrigatórios');
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        conflicts: { hasConflict: false },
        errors
      };
    }

    // Buscar psicólogo
    const psychologist = await this.prisma.psychologist.findUnique({
      where: { id: psychologistId }
    });

    if (!psychologist) {
      errors.push('Psicólogo não encontrado');
      return {
        isValid: false,
        conflicts: { hasConflict: false },
        errors
      };
    }

    // Verificar horário de funcionamento
    const isWithinWorkingHours = this.isWithinWorkingHours(
      command.datetime!,
      psychologist.workingHours as any
    );

    if (!isWithinWorkingHours) {
      errors.push('Horário fora do expediente');
    }

    // Verificar se é no passado
    if (command.datetime! < new Date()) {
      errors.push('Não é possível agendar no passado');
    }

    // Buscar ou criar paciente
    let patient = await this.findPatientByName(command.patient!, psychologistId);

    // Verificar conflitos
    const conflicts = await this.checkSchedulingConflicts(
      command.datetime!,
      psychologist.sessionDurationMinutes,
      psychologistId
    );

    return {
      isValid: errors.length === 0 && !conflicts.hasConflict,
      conflicts,
      patient,
      errors
    };
  }

  async validateCancelCommand(
    command: ParsedCommand,
    psychologistId: string
  ): Promise<{
    isValid: boolean;
    session?: any;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (!command.patient) {
      errors.push('Nome do paciente é obrigatório');
    }

    if (!command.datetime) {
      errors.push('Data é obrigatória');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Buscar paciente
    const patient = await this.findPatientByName(command.patient!, psychologistId);
    
    if (!patient) {
      errors.push(`Paciente ${command.patient} não encontrado`);
      return { isValid: false, errors };
    }

    // Buscar sessão no dia especificado
    const startOfDay = new Date(command.datetime!);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(command.datetime!);
    endOfDay.setHours(23, 59, 59, 999);

    const session = await this.prisma.session.findFirst({
      where: {
        psychologistId,
        patientId: patient.id,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: 'scheduled'
      },
      include: {
        patient: true
      }
    });

    if (!session) {
      errors.push(`Nenhuma sessão encontrada para ${command.patient} nesta data`);
    }

    return {
      isValid: errors.length === 0,
      session,
      errors
    };
  }

  async checkSchedulingConflicts(
    datetime: Date,
    durationMinutes: number,
    psychologistId: string
  ): Promise<ConflictInfo> {
    const sessionStart = new Date(datetime);
    const sessionEnd = new Date(datetime.getTime() + durationMinutes * 60000);

    // Verificar conflitos com sessões existentes
    const conflictingSession = await this.prisma.session.findFirst({
      where: {
        psychologistId,
        status: 'scheduled',
        OR: [
          // Sessão começa durante nossa sessão
          {
            scheduledAt: {
              gte: sessionStart,
              lt: sessionEnd
            }
          },
          // Sessão termina durante nossa sessão
          {
            AND: [
              { scheduledAt: { lt: sessionStart } },
              // Calcular fim da sessão existente
              {
                scheduledAt: {
                  gte: new Date(sessionStart.getTime() - 60 * 60000) // Máximo 60min antes
                }
              }
            ]
          }
        ]
      },
      include: {
        patient: true
      }
    });

    if (conflictingSession && conflictingSession.patient) {
      const conflictEnd = new Date(
        conflictingSession.scheduledAt.getTime() + 
        conflictingSession.durationMinutes * 60000
      );

      // Buscar horários disponíveis
      const availableSlots = await this.findAvailableSlots(
        datetime,
        durationMinutes,
        psychologistId
      );

      return {
        hasConflict: true,
        conflictingSession: {
          patientName: conflictingSession.patient.fullName,
          startTime: this.formatTime(conflictingSession.scheduledAt),
          endTime: this.formatTime(conflictEnd)
        },
        availableSlots
      };
    }

    // Verificar conflitos com bloqueios
    const availabilityBlock = await this.prisma.availabilityBlock.findFirst({
      where: {
        psychologistId,
        startTime: { lte: sessionStart },
        endTime: { gte: sessionEnd }
      }
    });

    if (availabilityBlock) {
      const availableSlots = await this.findAvailableSlots(
        datetime,
        durationMinutes,
        psychologistId
      );

      return {
        hasConflict: true,
        availableSlots
      };
    }

    return { hasConflict: false };
  }

  async findAvailableSlots(
    preferredDate: Date,
    durationMinutes: number,
    psychologistId: string,
    daysToCheck: number = 7
  ): Promise<AvailableSlot[]> {
    const psychologist = await this.prisma.psychologist.findUnique({
      where: { id: psychologistId }
    });

    if (!psychologist) return [];

    const workingHours = psychologist.workingHours as any;
    const slots: AvailableSlot[] = [];

    for (let i = 0; i < daysToCheck; i++) {
      const checkDate = new Date(preferredDate);
      checkDate.setDate(checkDate.getDate() + i);
      
      const daySlots = await this.getDayAvailableSlots(
        checkDate,
        durationMinutes,
        psychologistId,
        workingHours
      );
      
      slots.push(...daySlots);
      
      if (slots.length >= 6) break; // Limitar a 6 sugestões
    }

    return slots.slice(0, 6);
  }

  private async getDayAvailableSlots(
    date: Date,
    durationMinutes: number,
    psychologistId: string,
    workingHours: any
  ): Promise<AvailableSlot[]> {
    const dayName = this.getDayName(date.getDay());
    const dayWorkingHours = workingHours[dayName];
    
    if (!dayWorkingHours || dayWorkingHours === 'closed') {
      return [];
    }

    const [startHour, endHour] = dayWorkingHours.split('-');
    const [startH, startM] = startHour.split(':').map(Number);
    const [endH, endM] = endHour.split(':').map(Number);

    const dayStart = new Date(date);
    dayStart.setHours(startH, startM, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(endH, endM, 0, 0);

    // Buscar sessões existentes no dia
    const existingSessions = await this.prisma.session.findMany({
      where: {
        psychologistId,
        status: 'scheduled',
        scheduledAt: {
          gte: dayStart,
          lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    const slots: AvailableSlot[] = [];
    let currentTime = new Date(dayStart);

    // Se for hoje, não sugerir horários no passado
    if (this.isToday(date)) {
      const now = new Date();
      if (currentTime < now) {
        currentTime = new Date(now);
        currentTime.setMinutes(Math.ceil(currentTime.getMinutes() / 30) * 30); // Arredondar para próximos 30min
      }
    }

    while (currentTime.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);
      
      // Verificar se conflita com sessão existente
      const hasConflict = existingSessions.some(session => {
        const sessionEnd = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60000);
        return (
          (currentTime >= session.scheduledAt && currentTime < sessionEnd) ||
          (slotEnd > session.scheduledAt && slotEnd <= sessionEnd) ||
          (currentTime <= session.scheduledAt && slotEnd >= sessionEnd)
        );
      });

      if (!hasConflict) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(slotEnd),
          formatted: this.formatTimeSlot(currentTime, slotEnd)
        });
      }

      // Avançar em intervalos de 30 minutos
      currentTime.setMinutes(currentTime.getMinutes() + 30);
    }

    return slots;
  }

  async findPatientByName(name: string, psychologistId: string): Promise<any> {
    // Busca exata primeiro
    let patient = await this.prisma.patient.findFirst({
      where: {
        psychologistId,
        fullName: { equals: name, mode: 'insensitive' }
      }
    });

    if (patient) return patient;

    // Busca fuzzy se não encontrou exata
    const patients = await this.prisma.patient.findMany({
      where: { psychologistId }
    });

    return this.findBestNameMatch(name, patients);
  }

  private findBestNameMatch(inputName: string, patients: any[]): any | null {
    if (patients.length === 0) return null;

    const threshold = 0.7;
    let bestMatch: any = null;
    let bestScore = 0;

    for (const patient of patients) {
      const similarity = this.calculateStringSimilarity(
        inputName.toLowerCase(),
        patient.fullName.toLowerCase()
      );
      
      if (similarity > threshold && similarity > bestScore) {
        bestMatch = patient;
        bestScore = similarity;
      }
    }

    return bestMatch;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1,
          matrix[j - 1]![i]! + 1,
          matrix[j - 1]![i - 1]! + indicator
        );
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  private isWithinWorkingHours(datetime: Date, workingHours: any): boolean {
    const dayName = this.getDayName(datetime.getDay());
    const dayWorkingHours = workingHours?.[dayName];
    
    if (!dayWorkingHours || dayWorkingHours === 'closed') {
      return false;
    }

    const [startTime, endTime] = dayWorkingHours.split('-');
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const sessionHour = datetime.getHours();
    const sessionMinute = datetime.getMinutes();

    const sessionTimeInMinutes = sessionHour * 60 + sessionMinute;
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;

    return sessionTimeInMinutes >= startTimeInMinutes && sessionTimeInMinutes < endTimeInMinutes;
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    return days[dayOfWeek] || 'dom';
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  }

  private formatTimeSlot(start: Date, end: Date): string {
    const startStr = this.formatTime(start);
    const endStr = this.formatTime(end);
    return `${startStr} - ${endStr}`;
  }
}