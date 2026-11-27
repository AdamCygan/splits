/** Słupek wykresu dzień po dniu: jeden dzień albo tydzień (przy długim okresie). */
export interface ChartBucket {
  from: string
  to: string
  unit: 'day' | 'week'
}
