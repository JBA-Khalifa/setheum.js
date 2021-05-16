// Copyright 2017-2021 @polkadot/api authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DispatchError, DispatchInfo, EventRecord, ExtrinsicStatus } from '@polkadot/types/interfaces';
import type { AnyJson, ISubmittableResult } from '@polkadot/types/types';
import type { SubmittableResultValue } from './types';

const recordIdentity = (record: EventRecord) => record;

function filterAndApply <T> (events: EventRecord[], section: string, methods: string[], onFound: (record: EventRecord) => T): T[] {
  return events
    .filter(({ event }) => section === event.section && methods.includes(event.method))
    .map((record) => onFound(record));
}

function extractError (events: EventRecord[] = []): DispatchError | undefined {
  return filterAndApply(events, 'system', ['ExtrinsicFailed'], ({ event: { data } }) =>
    data[0] as DispatchError
  )[0];
}

function extractInfo (events: EventRecord[] = []): DispatchInfo | undefined {
  return filterAndApply(events, 'system', ['ExtrinsicFailed', 'ExtrinsicSuccess'], ({ event: { data, method } }) =>
    method === 'ExtrinsicSuccess'
      ? data[0] as DispatchInfo
      : data[1] as DispatchInfo
  )[0];
}

export class SubmittableResult implements ISubmittableResult {
  public readonly dispatchError?: DispatchError;

  public readonly dispatchInfo?: DispatchInfo;

  public readonly internalError?: Error;

  public readonly events: EventRecord[];

  public readonly status: ExtrinsicStatus;

  constructor ({ dispatchError, dispatchInfo, events, internalError, status }: SubmittableResultValue) {
    this.dispatchError = dispatchError || extractError(events);
    this.dispatchInfo = dispatchInfo || extractInfo(events);
    this.events = events || [];
    this.internalError = internalError;
    this.status = status;
  }

  public get isCompleted (): boolean {
    return this.isError || this.status.isInBlock || this.status.isFinalized;
  }

  public get isError (): boolean {
    return this.status.isDropped || this.status.isFinalityTimeout || this.status.isInvalid || this.status.isUsurped;
  }

  public get isFinalized (): boolean {
    return this.status.isFinalized;
  }

  public get isInBlock (): boolean {
    return this.status.isInBlock;
  }

  public get isWarning (): boolean {
    return this.status.isRetracted;
  }

  /**
   * @description Filters EventRecords for the specified method & section (there could be multiple)
   */
  public filterRecords (section: string, method: string | string[]): EventRecord[] {
    return filterAndApply(this.events, section, Array.isArray(method) ? method : [method], recordIdentity);
  }

  /**
   * @description Finds an EventRecord for the specified method & section
   */
  public findRecord (section: string, method: string | string[]): EventRecord | undefined {
    return this.filterRecords(section, method)[0];
  }

  /**
   * @description Creates a human representation of the output
   */
  public toHuman (isExtended?: boolean): AnyJson {
    return {
      dispatchError: this.dispatchError?.toHuman(),
      dispatchInfo: this.dispatchInfo?.toHuman(),
      events: this.events.map((event) => event.toHuman(isExtended)),
      internalError: this.internalError?.message.toString(),
      status: this.status.toHuman(isExtended)
    };
  }
}
