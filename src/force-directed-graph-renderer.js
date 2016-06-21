/* eslint-disable no-magic-numbers */
import d3 from 'd3';

export default class ForceDirectedGraphRenderer {
  constructor(containerElement) {
    this.containerElement = containerElement;
  }

  render(users) {
    const width = 1000;
    const height = 700;
    const radius = 15;

    const vis = d3
      .select(this.containerElement)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const links = [];

    users.forEach((user, userIndex) => {
      if (user.manager) {
        const manager = users.find(x => x.id === user.manager.id);

        if (manager) {
          const managerIndex = users.findIndex(x => x.id === manager.id);

          links.push({
            source: userIndex,
            target: managerIndex
          });
        } else {
          // eslint-disable-next-line no-console
          console.log(`Missing manager for ${user.displayName} (${user.id}) in data.`);
        }
      }
    });

    const link = vis.selectAll('line')
      .data(links)
      .enter().append('line');

    const node = vis.selectAll('.node')
      .data(users)
      .enter().append('g')
      .attr('class', 'node')
      .on('mouseover', d => this.onNodeMouseOver(d));

    node.append('circle')
      .attr('r', d => {
        if (!d.manager) {
          return radius * 1.6;
        }

        const atLeastOneDirectReport = users.some(x => x.manager && x.manager.id === d.id);

        const manager = users.find(x => x.id === d.manager.id);

        if (!manager.manager && atLeastOneDirectReport) {
          return radius * 1.5;
        }

        if (atLeastOneDirectReport) {
          return radius * 1.2;
        }

        return radius;
      });

    this.updateGrouping();
    document
      .querySelectorAll('#js-group-by-container input')
      .forEach(x => (x.onclick = () => this.updateGrouping()));

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('class', 'circle-text')
      .text(x => this.getNameAbbreviation(x.displayName));

    const force = d3.layout.force()
      .nodes(users)
      .links(links)
      .size([width, height])
      .linkDistance(30)
      .charge(-400)
      .gravity(0.3)
      .start();

    node.call(force.drag);

    force.on('tick', () => {
      link.attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

      d3.selectAll('circle')
          .attr('cx', d => Math.max(radius, Math.min(width - radius, d.x)))
          .attr('cy', d => Math.max(radius, Math.min(height - radius, d.y)));

      d3.selectAll('.circle-text')
        .attr('x', d => Math.max(radius, Math.min(width - radius, d.x)))
        .attr('y', d => Math.max(radius, Math.min(height - radius, d.y)) + 5);
    });
  }

  updateGrouping() {
    const groupByDepartment = document.getElementById('js-group-by-department');
    const groupByLocation = document.getElementById('js-group-by-location');

    let groupBy = () => { }; // eslint-disable-line no-empty-function

    if (groupByDepartment.checked) {
      groupBy = d => d.department;
    } else if (groupByLocation.checked) {
      groupBy = d => `${d.city || ''}${d.city ? ',' : ''} ${d.state || ''}`;
    }

    const circles = d3.select(this.containerElement)
      .selectAll('circle');

    const uniqueGroupItems = Array.from(new Set(circles.data().map(d => groupBy(d))));

    const color = uniqueGroupItems.length > 10
      ? d3.scale.category20()
      : d3.scale.category10();

    circles.style('fill', d => color(groupBy(d)));

    const groupsWithColors = Array.from(new Set(circles.data().map(d => {
      return {
        group: groupBy(d),
        color: color(groupBy(d))
      };
    })));

    const uniqueGroupsWithColors = [];

    groupsWithColors.forEach(x => {
      if (!uniqueGroupsWithColors.some(y => y.group === x.group)) {
        uniqueGroupsWithColors.push(x);
      }
    });

    this.updateLegend(uniqueGroupsWithColors);
  }

  updateLegend(groupsWithColors) {
    groupsWithColors
      .sort((x, y) => x.group.localeCompare(y.group));

    const groupScale = d3.scale.ordinal()
      .domain(groupsWithColors.map(x => x.group))
      .range(groupsWithColors.map(x => x.color));

    const svg = d3.select(this.containerElement)
      .select('svg');

    svg.append('g')
      .attr('class', 'legend-ordinal')
      .attr('transform', 'translate(20, 20)');

    const legendOrdinal = d3.legend.color()
      .scale(groupScale);

    svg.select('.legend-ordinal')
      .call(legendOrdinal);
  }

  search(str) {
    const searchNonMatchClass = 'search-non-match';
    const regExp = new RegExp(str, 'gi');

    d3.select(this.containerElement)
      .selectAll('circle')
      .classed(searchNonMatchClass, false)
      .filter(x => str && !(
          (x.displayName && x.displayName.match(regExp))
          || (x.jobTitle && x.jobTitle.match(regExp))
          || (x.department && x.department.match(regExp))
          || (x.telephoneNumber && x.telephoneNumber.match(regExp))
          || (x.mobileNumber && x.mobileNumber.match(regExp))
          || (x.email && x.email.match(regExp))
        )
      )
      .classed(searchNonMatchClass, true);

    // If single match found, select that match
    const highlightedCircles = d3.select(this.containerElement)
      .selectAll(`circle:not(.${searchNonMatchClass})`);

    if (highlightedCircles[0].length === 1) {
      const d = highlightedCircles.datum();

      this.onNodeMouseOver(d);
    }
  }

  getNameAbbreviation(displayName) {
    const split = displayName.split(' ');

    if (split.length > 0) {
      const givenName = split[0];
      const surName = split[1];

      const firstLetter = givenName ? givenName[0] : '?';
      const secondLetter = surName ? surName[0] : '';

      return `${firstLetter}${secondLetter}`;
    }
  }

  onNodeMouseOver(d) {
    const highlightClass = 'highlight';

    d3.select(this.containerElement)
      .selectAll('circle')
      .classed(highlightClass, false)
      .filter(x => x.id === d.id)
      .classed(highlightClass, true);

    this._setElementIdText('js-information-name', d.displayName);
    this._setElementIdText('js-information-job-title', d.jobTitle);
    this._setElementIdText('js-information-department', d.department);
    this._setElementIdText('js-location', `${d.city || ''}${d.city ? ',' : ''} ${d.state || ''}`);
    this._setElementIdText('js-information-telephone-number', d.telephoneNumber ? `Phone: ${d.telephoneNumber}` : '');
    this._setElementIdText('js-information-mobile-number', d.mobileNumber ? `Mobile: ${d.mobileNumber}` : '');

    const emailLink = document.getElementById('js-information-email-link');

    emailLink.innerText = d.email;
    emailLink.href = `mailto:${encodeURI(d.email)}`;
  }

  _setElementIdText(id, text) {
    document.getElementById(id).innerText = text;
  }
}
