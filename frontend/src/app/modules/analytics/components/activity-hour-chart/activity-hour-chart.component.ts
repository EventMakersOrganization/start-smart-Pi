import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as d3 from 'd3';
import type { ActivityByHourResponse } from '../../services/analytics.service';

@Component({
  selector: 'app-activity-hour-chart',
  templateUrl: './activity-hour-chart.component.html',
  styleUrls: ['./activity-hour-chart.component.css'],
})
export class ActivityHourChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;

  @Input() data: ActivityByHourResponse | null = null;
  /** Highlighted bucket index (e.g. drill-down selection). */
  @Input() selectedIndex: number | null = null;

  @Output() bucketClick = new EventEmitter<{ index: number; hourLabel: string }>();

  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(this.host.nativeElement);
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['data'] || changes['selectedIndex']) && this.host) {
      queueMicrotask(() => this.render());
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  private render(): void {
    const el = this.host?.nativeElement;
    if (!el) {
      return;
    }

    const width = el.clientWidth || 400;
    const height = 256;
    const margin = { top: 12, right: 8, bottom: 28, left: 36 };

    d3.select(el).selectAll('svg').remove();

    const svg = d3
      .select(el)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', 'Activity by hour chart');

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const d = this.data;
    if (!d || !d.hourLabels?.length) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .attr('class', 'fill-slate-400 text-xs')
        .text('No activity data');
      return;
    }

    const n = d.hourLabels.length;
    const indices = d.hourLabels.map((_, i) => i);

    const x = d3.scaleBand<number>().domain(indices).range([0, innerW]).padding(0.15);

    const activityMax = d3.max(d.activityCounts, (v) => v) ?? 1;
    const sessionMax = d3.max(d.sessionCounts, (v) => v) ?? 0;
    const yMax = Math.max(1, activityMax, sessionMax);

    const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

    g.append('g')
      .attr('class', 'axis-y text-[10px] text-slate-500')
      .call(d3.axisLeft(y).ticks(4).tickFormat((v) => String(v)));

    const tickEvery = Math.max(1, Math.ceil(n / 8));
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .attr('class', 'axis-x text-[9px] text-slate-500')
      .call(
        d3.axisBottom(x).tickFormat((i) => {
          const idx = i as number;
          return idx % tickEvery === 0 ? d.hourLabels[idx] : '';
        }),
      )
      .selectAll('text')
      .attr('transform', 'rotate(-35)')
      .style('text-anchor', 'end');

    // Sessions (underlay)
    g.selectAll('rect.session')
      .data(indices)
      .join('rect')
      .attr('class', 'session')
      .attr('x', (i) => x(i) ?? 0)
      .attr('y', (i) => y(d.sessionCounts[i] ?? 0))
      .attr('width', x.bandwidth())
      .attr('height', (i) => innerH - y(d.sessionCounts[i] ?? 0))
      .attr('fill', 'var(--md-sys-color-secondary, #5c6bc0)')
      .attr('opacity', 0.35)
      .attr('rx', 2);

    // Activity
    g.selectAll('rect.activity')
      .data(indices)
      .join('rect')
      .attr('class', 'activity')
      .attr('x', (i) => x(i) ?? 0)
      .attr('y', (i) => y(d.activityCounts[i] ?? 0))
      .attr('width', x.bandwidth())
      .attr('height', (i) => innerH - y(d.activityCounts[i] ?? 0))
      .attr('fill', 'var(--md-sys-color-primary, #1976d2)')
      .attr('opacity', (i) => (this.selectedIndex === i ? 1 : 0.88))
      .attr('stroke', (i) => (this.selectedIndex === i ? '#0d47a1' : 'none'))
      .attr('stroke-width', (i) => (this.selectedIndex === i ? 2 : 0))
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('click', (event, i) => {
        event.stopPropagation();
        this.bucketClick.emit({ index: i, hourLabel: d.hourLabels[i] });
      });
  }
}
