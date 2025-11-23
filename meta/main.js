import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line:   Number(row.line),
    depth:  Number(row.depth),
    length: Number(row.length),
    date:    new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;

      const ret = {
        id: commit,
        url: 'https://github.com/LeDoesCS/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    }).sort((a, b) => a.datetime - b.datetime);
}

let commitProgress = 100; 
let timeScale;  
let commitMaxTime;

function renderCommitInfo(data, commits) {
  const fmtInt = d3.format(',');

  const statsDiv = d3.select('#stats');
  statsDiv.selectAll('*').remove();

  const card = statsDiv.append('div').attr('class', 'stats-card');

  card.append('div')
    .attr('class', 'stats-header')
    .html('<h2 style="margin:0">Summary</h2>');

  const dl = card.append('dl').attr('class', 'stats-grid');

  const add = (label, value) => {
    dl.append('dt').text(label);
    dl.append('dd').text(fmtInt(value));
  };

  const numFiles = d3.group(data, d => d.file).size;
  const maxDepth = d3.max(data, d => d.depth) ?? 0;
  const longestLineLen = d3.max(data, d => d.length) ?? 0;
  const longestFileEntry = d3.greatest(
    d3.rollups(data, v => d3.max(v, d => d.line), d => d.file),
    d => d[1]
  );
  const maxLines = longestFileEntry?.[1] ?? 0;

  dl.append('dt').text('Commits');
  dl.append('dd')
    .attr('id', 'stat-commits')
    .text(fmtInt(commits.length));

  add('Files', numFiles);
  add('Total LOC', data.length);
  add('Max depth', maxDepth);
  add('Longest line', longestLineLen);
  add('Max lines', maxLines);
}
let xScale, yScale;

function renderScatterPlot(data, commits) {
  if (!commits || !commits.length) return;

  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 30, bottom: 30, left: 0 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('max-width', '100%')
    .style('height', 'auto');

    const [minDateRaw, maxDateRaw] = d3.extent(commits, d => d.datetime);

    xScale = d3.scaleTime()
  .domain(d3.extent(commits, d => d.datetime))  // full range
  .nice()
  .range([usableArea.left, usableArea.right]);


    yScale = d3
     .scaleLinear()
     .domain([0, 24])
     .range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt()
    .domain([minLines || 1, maxLines || 1])
    .range([3, 18]);

  const sortedCommits = d3.sort(commits, d => -d.totalLines);

  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

  gridlines.call(
    d3.axisLeft(yScale)
      .tickFormat('')
      .tickSize(-usableArea.width)
  );

  const monthStart = d3.timeMonth.floor(minDateRaw); 
  const xTickValues = d3.timeDay.range(
  monthStart,
  d3.timeDay.offset(maxDateRaw, 2),
  2 );

  const xAxis = d3.axisBottom(xScale)
  .tickValues(xTickValues)
  .tickFormat(d3.timeFormat('%b %d'));

  const yAxis = d3.axisLeft(yScale)
    .tickValues([0, 6, 12, 18, 24])
    .tickFormat(d => String(d).padStart(2, '0') + ':00');

  svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg.append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  const dots = svg.append('g').attr('class', 'dots');

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .style('--r', d => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });


  function isCommitSelected(selection, commit) {
    if (!selection) return false;

    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);

    return x0 <= x && x <= x1 && y0 <= y && y <= y1;
  }

  function renderSelectionCount(selection) {
    const selectedCommits = selection
      ? commits.filter(d => isCommitSelected(selection, d))
      : [];

    const countElement = document.querySelector('#selection-count');
    if (countElement) {
      countElement.textContent = `${
        selectedCommits.length || 'No'
      } commits selected`;
    }

    return selectedCommits;
  }

  function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
      ? commits.filter(d => isCommitSelected(selection, d))
      : [];

    const container = document.getElementById('language-breakdown');
    if (!container) return;

    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }

    const lines = selectedCommits.flatMap(d => d.lines);

    const breakdown = d3.rollup(
      lines,
      v => v.length,
      d => d.type 
    );

    container.innerHTML = '';

    for (const [language, count] of breakdown) {
      const proportion = count / lines.length;
      const formatted = d3.format('.1~%')(proportion);

      container.innerHTML += `
        <dt>${language}</dt>
        <dd>
            <span class="lang-lines">${count} lines</span>
            <span class="lang-percent">${formatted}</span>
        </dd>
`;
    }
  }

  function brushed(event) {
    const selection = event.selection;

    dots.selectAll('circle')
      .classed('selected', d => isCommitSelected(selection, d));

    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  const brush = d3.brush()
    .extent([
      [usableArea.left,  usableArea.top],
      [usableArea.right, usableArea.bottom],
    ])
    .on('start brush end', brushed);

  svg.append('g')
    .attr('class', 'brush')
    .call(brush);

  svg.selectAll('.dots, .overlay ~ *').raise();
}

function updateScatterPlot(commitsFiltered) {
  const svg = d3.select('#chart').select('svg');
  if (svg.empty()) return;

  const width = 1000, height = 600;
  const margin = { top: 10, right: 30, bottom: 30, left: 0 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  if (!commitsFiltered || commitsFiltered.length === 0) {
    svg.select('g.x-axis').call(d3.axisBottom(xScale).tickValues([]));
    svg.select('g.dots').selectAll('circle').remove();
    return;
  }

  const extent = d3.extent(commitsFiltered, d => d.datetime);
  if (extent[0] && extent[1]) xScale.domain(extent).nice();

  const monthStart = d3.timeMonth.floor(extent[0]);
  const xTickValues = d3.timeDay.range(
    monthStart,
    d3.timeDay.offset(extent[1], 2),
    2
  );
  const xAxis = d3.axisBottom(xScale)
    .tickValues(xTickValues)
    .tickFormat(d3.timeFormat('%b %d'));

  svg.select('g.x-axis').call(xAxis);

  const [minLines, maxLines] = d3.extent(commitsFiltered, d => d.totalLines);
  const rScale = d3.scaleSqrt()
    .domain([minLines || 1, maxLines || 1])
    .range([3, 18]);

  const dots = svg.select('g.dots');
  const sorted = d3.sort(commitsFiltered, d => -d.totalLines);

  dots.selectAll('circle')
    .data(sorted, (d) => d.id)
    .join(
      enter => enter.append('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .style('--r', d => rScale(d.totalLines))
        .attr('fill', 'steelblue')
        .style('fill-opacity', 0.7)
        .on('mouseenter', (event, commit) => {
          d3.select(event.currentTarget).style('fill-opacity', 1);
          renderTooltipContent(commit);
          updateTooltipVisibility(true);
          updateTooltipPosition(event);
        })
        .on('mouseleave', (event) => {
          d3.select(event.currentTarget).style('fill-opacity', 0.7);
          updateTooltipVisibility(false);
        }),
      update => update
        .transition().duration(150) 
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r',  d => rScale(d.totalLines))
        .style('--r', d => rScale(d.totalLines)),
      exit => exit.remove()
    );
}


function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  tooltip.hidden = !isVisible;
}

function renderTooltipContent(commit) {
  const tooltip = document.getElementById('commit-tooltip');
  const link    = document.getElementById('commit-link');
  const dateEl  = document.getElementById('commit-date');

  if (!commit || Object.keys(commit).length === 0) {
    if (tooltip) tooltip.hidden = true;
    return;
  }

  tooltip.hidden = false;

  link.href = commit.url;
  link.textContent = commit.id;

  dateEl.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top  = `${event.clientY + 12}px`;
}

const data = await loadData();
const typeColor = d3
  .scaleOrdinal(d3.schemeTableau10)
  .domain(d3.union(data.map(d => d.type)));
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);


timeScale = d3.scaleTime().domain([
    d3.min(commits, d => d.datetime),
    d3.max(commits, d => d.datetime),]).range([0, 100]);

commitMaxTime = timeScale.invert(commitProgress);

const sliderEl = document.getElementById('commit-progress');
const timeEl   = document.getElementById('commit-time');

function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap(d => d.lines);
  const files = d3
    .groups(lines, d => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const rows = d3.select('#files')
    .selectAll('div.file-row')
    .data(files, d => d.name)
    .join(
      enter => enter.append('div')
        .attr('class', 'file-row')
        .call(div => {
          const dt = div.append('dt');
          dt.append('code');     
          dt.append('small');    
          div.append('dd');    
        }),
      update => update,
      exit => exit.remove()
    );

  rows.select('dt > code').text(d => d.name);
  rows.select('dt > small').text(d => `${d.lines.length} lines`);

  rows.select('dd')
    .selectAll('div.loc')
    .data(d => d.lines, (line, i) => i)  
    .join(
      enter => enter.append('div')
        .attr('class', 'loc')
        .style('--color', line => typeColor(line.type))
        .style('opacity', 0)
        .each(function(){ this.offsetWidth; })
        .style('opacity', 1),
      update => update,
      exit => exit
        .style('opacity', 0)
        .remove()
    );
}

updateFileDisplay(commits);


function onTimeSliderChange() {
  commitProgress = Number(sliderEl.value);
  commitMaxTime  = timeScale.invert(commitProgress);

  timeEl.dateTime = commitMaxTime.toISOString();
  timeEl.textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);
  const fmtInt = d3.format(",");
  const el = document.getElementById('stat-commits');
  if (el) el.textContent = fmtInt(filteredCommits.length);
  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits);
}

sliderEl.addEventListener('input', onTimeSliderChange);
onTimeSliderChange();


function renderCommitSteps(commits) {
  const stepSel = d3
    .select('#scatter-story')
    .selectAll('.step')
    .data(commits, d => d.id);

  stepSel.join(
    enter => enter
      .append('div')
      .attr('class', 'step')
      .attr('data-progress', d => timeScale(d.datetime))
      .html(d => {
        const filesTouched = d3.rollups(
          d.lines,
          v => v.length,
          r => r.file
        ).length;

        return `
          <p>
            On ${d.datetime.toLocaleString('en', {
              dateStyle: 'full',
              timeStyle: 'short',
            })},
            I made <a href="${d.url}" target="_blank" rel="noopener">another glorious commit</a>.
            I edited <strong>${d.totalLines}</strong> lines across <strong>${filesTouched}</strong> files.
            Then I looked over all I had made, and it was very good.
          </p>
        `;
      })
  );
}

function initScrolly(allCommits) {
  const scroller = scrollama();

  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scatter-story .step',
      offset: 0.6,
      debug: false,
    })
    .onStepEnter((response) => {
      d3.selectAll('#scatter-story .step').classed('is-active', false);
      d3.select(response.element).classed('is-active', true);

      const d = response.element.__data__;

      commitProgress = timeScale(d.datetime);
      sliderEl.value = commitProgress;

      commitMaxTime = d.datetime;
      timeEl.dateTime = commitMaxTime.toISOString();
      timeEl.textContent = commitMaxTime.toLocaleString('en', {
        dateStyle: 'long',
        timeStyle: 'short',
      });

      const filtered = allCommits.filter(c => c.datetime <= commitMaxTime);

      updateScatterPlot(filtered);

      const fmtInt = d3.format(",");
      const el = document.getElementById('stat-commits');
      if (el) el.textContent = fmtInt(filtered.length);

      updateFileDisplay(filtered);
    });

  window.addEventListener('resize', () => scroller.resize());
}

renderCommitSteps(commits);
initScrolly(commits);

