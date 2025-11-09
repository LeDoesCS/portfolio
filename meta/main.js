import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
    });
}

function renderCommitInfo(data, commits) {
  const statsDiv = d3.select('#stats');

  statsDiv.append('h2').text('Summary');

  const dl = statsDiv.append('dl').attr('class', 'stats');

  dl.append('dt').text('Commits');
  dl.append('dd').text(commits.length);

  const numFiles = d3.group(data, d => d.file).size;
  dl.append('dt').text('Files');
  dl.append('dd').text(numFiles);

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  const maxDepth = d3.max(data, d => d.depth);
  dl.append('dt').text('Max depth');
  dl.append('dd').text(maxDepth);

  const longestLineLen = d3.max(data, d => d.length);
  dl.append('dt').text('Longest line');
  dl.append('dd').text(longestLineLen);

  const longestFileEntry = d3.greatest(
    d3.rollups(
      data,
      v => d3.max(v, d => d.line),
      d => d.file
    ),
    d => d[1]
  );
  const maxLines = longestFileEntry?.[1] ?? 0;
  dl.append('dt').text('Max lines');
  dl.append('dd').text(maxLines);
}

function renderScatterPlot(data, commits) {
  if (!commits || !commits.length) return;

  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 40, left: 50 };

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

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .nice()
    .range([usableArea.left, usableArea.right]);

  const yScale = d3
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

  const xAxis = d3.axisBottom(xScale)
    .ticks(d3.timeDay.every(2))
    .tickFormat(d3.timeFormat('%b %d'));

  const yAxis = d3.axisLeft(yScale)
    .tickValues([0, 6, 12, 18, 24])
    .tickFormat(d => String(d).padStart(2, '0') + ':00');

  svg.append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  const dots = svg.append('g').attr('class', 'dots');

  dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
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

  // ---------- brushing helpers (capturing xScale, yScale, commits) ----------

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

  // keep dots above overlay so hover/tooltip works
  svg.selectAll('.dots, .overlay ~ *').raise();
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
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);